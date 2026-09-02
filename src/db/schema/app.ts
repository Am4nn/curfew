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
});

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  typeKey: text("type_key").notNull(), // 'sleep' in v1; registry key
  period: text("period").notNull(), // day | week | month, denormalised from the type
  name: text("name"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
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
export const activityRules = pgTable("activity_rules", {
  version: serial("version").primaryKey(),
  activityId: uuid("activity_id").references(() => activities.id, {
    onDelete: "cascade",
  }), // null = default
  fineMode: text("fine_mode").notNull().default("flat"), // flat | escalating
  fineAmount: bigint("fine_amount", { mode: "number" }).notNull(),
  fineStep: bigint("fine_step", { mode: "number" }).notNull().default(0),
  fineCap: bigint("fine_cap", { mode: "number" }),
  currency: char("currency", { length: 3 }).notNull().default("INR"),
  gracePerMonth: integer("grace_per_month").notNull().default(2),
  config: jsonb("config").notNull().default({}),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  changedBy: text("changed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Did this person meet THEIR OWN targets this period? Keyed by type, not
// activity: evaluated once per user per type per period, group-independent.
// Rebuildable from events.
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
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.typeKey, t.periodStart] })],
);

// The consequences of that period, per group activity: same pass/fail, but
// different money, streak and grace per group. Rebuildable from scores + rules.
export const activityOutcomes = pgTable(
  "activity_outcomes",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    typeKey: text("type_key").notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    graceUsed: boolean("grace_used").notNull().default(false),
    streakAfter: integer("streak_after").notNull().default(0),
    fineAmount: bigint("fine_amount", { mode: "number" }).notNull().default(0),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    rulesVersion: integer("rules_version")
      .notNull()
      .references(() => activityRules.version),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.userId, t.periodStart] })],
);

// Append-only, per group. Never update or delete: corrections are compensating
// rows, settlements are rows. A failed period writes one fine row per other
// active member; fine rows snapshot their own amount and currency and are never
// recomputed. amounts are minor units.
export const ledgerEntries = pgTable("ledger_entries", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").references(() => activities.id), // null for settlements
  fromUserId: text("from_user_id")
    .notNull()
    .references(() => users.id), // who owes
  toUserId: text("to_user_id")
    .notNull()
    .references(() => users.id), // who is owed
  amount: bigint("amount", { mode: "number" }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("INR"),
  kind: text("kind").notNull(), // fine | settlement | adjustment
  periodStart: date("period_start", { mode: "string" }), // null for settlements
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
