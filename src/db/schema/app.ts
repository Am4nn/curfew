import {
  pgTable,
  pgView,
  text,
  boolean,
  timestamp,
  uuid,
  date,
  jsonb,
  serial,
  bigserial,
  bigint,
  integer,
  numeric,
  char,
  primaryKey,
} from "drizzle-orm/pg-core";
import { users, sessions } from "./auth";

// Application tables we own. The authoritative data model is
// .planning/schema.sql, applied via numbered migrations. This file mirrors the
// subset the app queries with types; it grows one phase at a time. If a column
// exists in one and not the other, that is a bug.
//
// date columns use mode "string" so they round-trip as "yyyy-MM-dd", which is
// exactly what the domain layer (periodStart, resolveConfig) expects.

export const userApprovals = pgTable("user_approvals", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  isAdmin: boolean("is_admin").notNull().default(false), // kept in sync with role='admin'
  role: text("role").notNull().default("member"), // member | auditor | ops | moderator | admin

  requestedAt: timestamp("requested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: text("decided_by").references(() => users.id),
  disabledAt: timestamp("disabled_at", { withTimezone: true }), // soft-delete; blocks access
  // Why, so a ban can be told from an admin tidying up.
  disabledReason: text("disabled_reason"),
});

export type ApprovalStatus = "pending" | "approved" | "rejected" | "disabled";

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // owner | member
    joinedAt: date("joined_at", { mode: "string" }).notNull(), // scoring starts here
    leftAt: date("left_at", { mode: "string" }), // scoring stops here; balance survives
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);

// No group is public or discoverable. An invite exists only because an owner
// typed an email; it appears on the invitee's dashboard once they are approved.
// email is citext in the DB. status: pending | accepted | revoked (revoked
// covers both an owner revoking and an invitee declining).
export const groupInvites = pgTable("group_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  invitedBy: text("invited_by")
    .notNull()
    .references(() => users.id),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  // The recipient hid it without answering (migration 0016). The row stays
  // pending and the sender sees no change; it just stops being listed.
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
});

export const userSettings = pgTable("user_settings", {
  version: serial("version").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }), // null = default
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userActivityConfig = pgTable("user_activity_config", {
  version: serial("version").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }), // null = default
  typeKey: text("type_key").notNull(),
  config: jsonb("config").notNull(),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only source of truth. Global per user: no group_id, no activity_id.
// occurred_at is the server clock only. All writes go through recordEvent().
export const events = pgTable("events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: text("session_id").references(() => sessions.id, {
    onDelete: "set null",
  }),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Group's stake for one activity: fine policy, currency, grace. Insert-only and
// effective-dated; null activity_id is the default. amounts are minor units.
export const activityScores = pgTable(
  "activity_scores",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    typeKey: text("type_key").notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    passed: boolean("passed").notNull(),
    detail: jsonb("detail").notNull().default({}),
    userConfigVersion: integer("user_config_version")
      .notNull()
      .references(() => userActivityConfig.version),
    // Inside the activity's first 7 days: scored, but excluded from the
    // reputation delta (decision 54). Fines still apply.
    settling: boolean("settling").notNull().default(false),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.typeKey, t.periodStart] })],
);

// The consequences of that period, per group activity: same pass/fail, but
// different money, streak and grace per group. Rebuildable from scores + rules.
// The consequences of a period in ONE group: whether it counted there, whether
// grace forgave it, and what it cost. Keyed by type rather than by an activity
// row, because a group no longer owns the activity. See migrations/0012.
export const activityOutcomes = pgTable(
  "activity_outcomes",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    typeKey: text("type_key").notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    passed: boolean("passed").notNull(),
    graceUsed: boolean("grace_used").notNull().default(false),
    fineAmount: bigint("fine_amount", { mode: "number" }).notNull().default(0),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    rulesVersion: integer("rules_version"),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId, t.typeKey, t.periodStart] }),
  ],
);

export const ledgerEntries = pgTable("ledger_entries", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  typeKey: text("type_key"), // null for settlements
  fromUserId: text("from_user_id")
    .notNull()
    .references(() => users.id), // who owes
  toUserId: text("to_user_id")
    .notNull()
    .references(() => users.id), // who is owed
  // Frozen at insert and never rewritten (migration 0015). Deleting an account
  // renames the user, so a joined name would erase who owed what.
  fromUserName: text("from_user_name").notNull(),
  toUserName: text("to_user_name").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("INR"),
  kind: text("kind").notNull(), // fine | settlement | adjustment
  periodStart: date("period_start", { mode: "string" }), // null for settlements
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per fine, and the reason a fine can only be charged once
// (migration 0017). A fine is split among the members who passed, so the
// number of shares depends on who has been scored when the split runs;
// ledger_one_fine_idx makes each SHARE idempotent and the fine as a whole not.
// This carries the identity, so a second split conflicts here and leaves the
// ledger alone. It is a guard: ledger_entries is still the money.
export const finePostings = pgTable(
  "fine_postings",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    typeKey: text("type_key").notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.typeKey, t.periodStart, t.fromUserId] }),
  ],
);

// Per group, per currency. Mutual failures net to zero here. Created by
// migration 0002; declared existing so Drizzle reads it but never manages it.
export const balances = pgView("balances", {
  groupId: uuid("group_id"),
  userId: text("user_id"),
  currency: char("currency", { length: 3 }),
  netOwed: bigint("net_owed", { mode: "number" }),
}).existing();

// v3, decision 63. Which activity types the app offers. The module registry in
// code says what a type is; this says only whether it is available, which is
// the one thing an admin changes at runtime. Append-only: a change is a new
// row, resolved as "the latest row at or before an instant". effective_at is a
// timestamptz because admin switches take effect immediately (decision 65).
export const activityTypes = pgTable("activity_types", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  typeKey: text("type_key").notNull(),
  enabled: boolean("enabled").notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  changedBy: text("changed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// v3, decisions 64 to 67. Operational state an admin changes at runtime. Every
// table here is append-only and resolved as of an instant, because admin
// switches take effect immediately (decision 65). See migrations/0007.
export const appSettings = pgTable("app_settings", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
  changedBy: text("changed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Per-group overrides an admin sets. Money is a property of a group, not of a
// group's relationship to one activity type, so it lives here rather than on
// group_activity_types.
export const groupSettings = pgTable("group_settings", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
  changedBy: text("changed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Which activity types a group accepts. A member can only share a type the
// group accepts.
export const groupActivityTypes = pgTable("group_activity_types", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  typeKey: text("type_key").notNull(),
  accepted: boolean("accepted").notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
  changedBy: text("changed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// What an admin announced. A notice is a blocking overlay on every route: the
// app does nothing until it is acknowledged, one at a time, and acknowledging
// is final (decision 58). There is no dismiss, only "Got it", so an ack row is
// the whole state.
export const notices = pgTable("notices", {
  id: uuid("id").primaryKey().defaultRandom(),
  body: text("body").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
});

export const noticeAcks = pgTable(
  "notice_acks",
  {
    noticeId: uuid("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.noticeId, t.userId] })],
);

// Whether a user tracks a type, as distinct from how they have it set up. The
// settings are scoring config and stay future-dated in user_activity_config
// (invariant 4); the switch is operational and takes effect at once, because a
// future-dated switch-off would score the day you quit as a miss, which is the
// retroactive miss decision 59 forbids. See migrations/0008.
export const userActivities = pgTable("user_activities", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  typeKey: text("type_key").notNull(),
  enabled: boolean("enabled").notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Evidence photos. The row is written when the browser asks for an upload URL,
// and confirmed when the check-in that carries its key is recorded. Whether a
// photo is confirmed is derivable from events (invariant 1); this table holds
// what an event cannot: the object key, its size and type, and the date the
// photograph must be deleted. See migrations/0010.
export const evidence = pgTable("evidence", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  typeKey: text("type_key").notNull(),
  step: text("step").notNull(),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  // The press this photo belongs to; the check-in event carries the same key.
  idem: text("idem").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  bytes: integer("bytes").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  deleteAfter: date("delete_after", { mode: "string" }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// The streak, stored rather than derived on every read (migration 0019).
// Derived and replayable (invariant 1): the press moves it, the nightly close
// repairs it, streakOver rebuilds it from events, and verify diffs the two.
export const activityStreaks = pgTable(
  "activity_streaks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    typeKey: text("type_key").notNull(),
    current: integer("current").notNull().default(0),
    best: integer("best").notNull().default(0),
    lastDay: date("last_day", { mode: "string" }),
    // The week in flight, for a weekly type: which week, and how many days of
    // it are done. A weekly streak adds a day as it happens and the week is
    // judged when it ends, so the count has to survive between presses.
    weekStart: date("week_start", { mode: "string" }),
    weekSessions: integer("week_sessions").notNull().default(0),
    graceSpent: jsonb("grace_spent")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    closedThrough: date("closed_through", { mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.typeKey] })],
);

// Reputation, one row a day per scope. Derived and replayable (invariant 1);
// a null groupId is the global score. See migrations/0011.
export const reputationDaily = pgTable(
  "reputation_daily",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    score: numeric("score", { precision: 7, scale: 3 }).notNull(),
    delta: numeric("delta", { precision: 7, scale: 3 }).notNull(),
    reason: text("reason").notNull(),
    ceiling: numeric("ceiling", { precision: 7, scale: 3 }).notNull(),
    completion: numeric("completion", { precision: 4, scale: 3 }),
    // Which version of the curve produced this number (migration 0018). The
    // incremental close carries yesterday's score forward and will not carry a
    // row whose version it does not recognise.
    logicVersion: integer("logic_version").notNull().default(1),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

// The member's half of the two toggles (decision 16): share this type here, and
// share its evidence. Append-only and immediate. See migrations/0012.
export const memberShares = pgTable("member_shares", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  typeKey: text("type_key").notNull(),
  shared: boolean("shared").notNull(),
  shareEvidence: boolean("share_evidence").notNull().default(false),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
  changedBy: text("changed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// What a miss costs in this group, per type. Insert-only with a future
// effective_from (invariant 4). Grace is personal and lives on the user's own
// activity, not here.
export const groupActivityRules = pgTable("group_activity_rules", {
  version: serial("version").primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  typeKey: text("type_key").notNull(),
  fineMode: text("fine_mode").notNull().default("flat"),
  fineAmount: bigint("fine_amount", { mode: "number" }).notNull(),
  fineStep: bigint("fine_step", { mode: "number" }).notNull().default(0),
  fineCap: bigint("fine_cap", { mode: "number" }),
  currency: char("currency", { length: 3 }).notNull().default("INR"),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  changedBy: text("changed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// What somebody accepted, and when. Append-only and versioned: an old
// acceptance does not cover new wording, and a re-acceptance is another row.
// See migrations/0013.
export const consentRecords = pgTable("consent_records", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
});

// A member reporting a photo or a person. Append-only: reviewing sets the
// outcome and never deletes the row, so what was reported and what was done
// about it stays answerable. See migrations/0014.
export const reports = pgTable("reports", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  subjectId: text("subject_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  evidenceId: bigint("evidence_id", { mode: "number" }).references(() => evidence.id, {
    onDelete: "set null",
  }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  outcome: text("outcome").notNull().default("open"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});
