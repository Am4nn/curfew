import {
  pgTable,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

// Application tables we own. This file grows one phase at a time as tables are
// needed in typed queries. The authoritative data model is
// .planning/schema.sql, applied via numbered migrations. Do not let this file
// diverge from it; if a column exists in one and not the other, that is a bug.
//
// Phase 0 needs only user_approvals (the account gate). The rest of schema.sql
// is applied by migration but is added here as later phases consume it.

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

// Convenience for callers that only need the SQL default guard documented.
export const CURRENT_DATE = sql`CURRENT_DATE`;
