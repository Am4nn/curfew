import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  date,
  jsonb,
  serial,
  bigserial,
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
  isAdmin: boolean("is_admin").notNull().default(false),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: text("decided_by").references(() => users.id),
});

export type ApprovalStatus = "pending" | "approved" | "rejected";

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
