import { and, desc, eq, gte, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  userApprovals,
  users,
  sessions,
  groups,
  groupMembers,
  activityScores,
  activityOutcomes,
  groupActivityRules,
  ledgerEntries,
  events,
  balances,
} from "@/db/schema";
import { recordEvent } from "./events";
import { accountDisabledEmail, approvalEmail, sendEmailBestEffort } from "./email";
import { userBalances } from "./groups";
import { scoreAll } from "./scoring";
import { verifyAll, type Drift } from "./verify";
import {
  roleCapabilities,
  roleHas,
  hasAdminAccess as roleHasAdminAccess,
  isRole,
  type Capability,
  type Role,
} from "@/lib/capabilities";

// The user's role. is_admin is honoured as 'admin' for any row not yet migrated
// or seeded the old way.
export async function getRole(userId: string): Promise<Role> {
  const row = await db.query.userApprovals.findFirst({
    where: eq(userApprovals.userId, userId),
  });
  if (!row) return "member";
  if (isRole(row.role) && row.role !== "member") return row.role;
  return row.isAdmin ? "admin" : "member";
}

export async function can(userId: string, capability: Capability): Promise<boolean> {
  return roleHas(await getRole(userId), capability);
}

export async function requireCapability(
  userId: string,
  capability: Capability,
): Promise<void> {
  if (!(await can(userId, capability))) {
    throw new Error("You do not have permission for that.");
  }
}

export async function hasAdminAccess(userId: string): Promise<boolean> {
  return roleHasAdminAccess(await getRole(userId));
}

export async function getCapabilities(userId: string): Promise<Capability[]> {
  return roleCapabilities(await getRole(userId));
}

// Retained: 'admin' is the top role. Used where a plain admin check is clearer.
export async function isAdmin(userId: string): Promise<boolean> {
  return (await getRole(userId)) === "admin";
}

async function scalar(query: Promise<{ n: unknown }[]>): Promise<number> {
  const [row] = await query;
  return Number(row?.n ?? 0);
}

// ---- Overview -------------------------------------------------------------

export interface Overview {
  usersTotal: number;
  usersPending: number;
  usersApproved: number;
  admins: number;
  groups: number;
  activeMemberships: number;
  events: number;
  checkins7d: number;
  totalFined: number; // minor units, fines only
  outstanding: number; // sum of positive net balances
  lastScoredAt: Date | null;
}

export async function getOverview(): Promise<Overview> {
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [
    usersTotal,
    usersPending,
    usersApproved,
    admins,
    groupCount,
    activeMemberships,
    eventCount,
    checkins7d,
    totalFined,
    outstanding,
    lastScoredRow,
  ] = await Promise.all([
    scalar(db.select({ n: sql`count(*)` }).from(users)),
    scalar(db.select({ n: sql`count(*)` }).from(userApprovals).where(eq(userApprovals.status, "pending"))),
    scalar(db.select({ n: sql`count(*)` }).from(userApprovals).where(eq(userApprovals.status, "approved"))),
    scalar(db.select({ n: sql`count(*)` }).from(userApprovals).where(eq(userApprovals.isAdmin, true))),
    scalar(db.select({ n: sql`count(*)` }).from(groups).where(isNull(groups.archivedAt))),
    scalar(db.select({ n: sql`count(*)` }).from(groupMembers).where(isNull(groupMembers.leftAt))),
    scalar(db.select({ n: sql`count(*)` }).from(events)),
    scalar(db.select({ n: sql`count(*)` }).from(events).where(and(like(events.type, "checkin.%"), gte(events.occurredAt, weekAgo)))),
    scalar(db.select({ n: sql`coalesce(sum(${ledgerEntries.amount}),0)` }).from(ledgerEntries).where(eq(ledgerEntries.kind, "fine"))),
    scalar(db.select({ n: sql`coalesce(sum(${balances.netOwed}),0)` }).from(balances).where(sql`${balances.netOwed} > 0`)),
    db.select({ ts: sql<Date | null>`max(${activityOutcomes.computedAt})` }).from(activityOutcomes),
  ]);

  return {
    usersTotal,
    usersPending,
    usersApproved,
    admins,
    groups: groupCount,
    activeMemberships,
    events: eventCount,
    checkins7d,
    totalFined,
    outstanding,
    lastScoredAt: lastScoredRow[0]?.ts ? new Date(lastScoredRow[0].ts) : null,
  };
}

// ---- Users ----------------------------------------------------------------

export interface PendingUser {
  userId: string;
  email: string;
  name: string;
  requestedAt: Date;
}

export async function listPendingApprovals(): Promise<PendingUser[]> {
  return db
    .select({
      userId: userApprovals.userId,
      email: users.email,
      name: users.name,
      requestedAt: userApprovals.requestedAt,
    })
    .from(userApprovals)
    .innerJoin(users, eq(users.id, userApprovals.userId))
    .where(eq(userApprovals.status, "pending"));
}

export interface AdminUserRow {
  userId: string;
  name: string;
  email: string;
  status: string;
  role: string;
  disabled: boolean;
  groupCount: number;
  lastEventAt: Date | null;
}

export async function listAllUsers(): Promise<AdminUserRow[]> {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      status: sql<string>`coalesce(${userApprovals.status}, 'pending')`,
      role: sql<string>`case when coalesce(${userApprovals.isAdmin}, false) then 'admin' else coalesce(${userApprovals.role}, 'member') end`,
      disabled: sql<boolean>`(${userApprovals.disabledAt} is not null)`,
      groupCount: sql<number>`(select count(*) from group_members gm where gm.user_id = ${users.id} and gm.left_at is null)`,
      lastEventAt: sql<Date | null>`(select max(occurred_at) from events e where e.user_id = ${users.id})`,
    })
    .from(users)
    .leftJoin(userApprovals, eq(userApprovals.userId, users.id))
    .orderBy(users.name);
}

export interface UserInspector {
  profile: { userId: string; name: string; email: string; status: string; role: string; disabled: boolean };
  recentCheckins: { step: string; at: Date }[];
  recentScores: { periodStart: string; passed: boolean; detail: unknown }[];
  recentOutcomes: { periodStart: string; groupName: string; typeKey: string; passed: boolean; graceUsed: boolean; fineAmount: number; currency: string }[];
  balances: { groupId: string; currency: string; netOwed: number }[];
}

export async function getUserInspector(userId: string): Promise<UserInspector | null> {
  const [p] = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      status: sql<string>`coalesce(${userApprovals.status}, 'pending')`,
      role: sql<string>`case when coalesce(${userApprovals.isAdmin}, false) then 'admin' else coalesce(${userApprovals.role}, 'member') end`,
      disabled: sql<boolean>`(${userApprovals.disabledAt} is not null)`,
    })
    .from(users)
    .leftJoin(userApprovals, eq(userApprovals.userId, users.id))
    .where(eq(users.id, userId));
  if (!p) return null;

  const [checkins, scores, outcomes, bals] = await Promise.all([
    db
      .select({ type: events.type, at: events.occurredAt })
      .from(events)
      .where(and(eq(events.userId, userId), like(events.type, "checkin.sleep.%")))
      .orderBy(desc(events.occurredAt))
      .limit(20),
    db
      .select({ periodStart: activityScores.periodStart, passed: activityScores.passed, detail: activityScores.detail })
      .from(activityScores)
      .where(eq(activityScores.userId, userId))
      .orderBy(desc(activityScores.periodStart))
      .limit(14),
    db
      .select({
        periodStart: activityOutcomes.periodStart,
        groupName: groups.name,
        typeKey: activityOutcomes.typeKey,
        passed: activityOutcomes.passed,
        graceUsed: activityOutcomes.graceUsed,
        fineAmount: activityOutcomes.fineAmount,
        currency: activityOutcomes.currency,
      })
      .from(activityOutcomes)
      .innerJoin(groups, eq(groups.id, activityOutcomes.groupId))
      .where(eq(activityOutcomes.userId, userId))
      .orderBy(desc(activityOutcomes.periodStart))
      .limit(14),
    userBalances(userId),
  ]);

  return {
    profile: p,
    recentCheckins: checkins.map((c) => ({ step: c.type.split(".").pop()!, at: c.at })),
    recentScores: scores,
    recentOutcomes: outcomes,
    balances: bals,
  };
}

// ---- Groups ---------------------------------------------------------------

export interface AdminGroupRow {
  groupId: string;
  name: string;
  memberCount: number;
  totalFined: number;
  archived: boolean;
}

export async function listAllGroups(): Promise<AdminGroupRow[]> {
  // Aggregated separately then merged, rather than correlated subqueries: an
  // unqualified outer column reference inside a subquery whose table also has
  // that column name (ledger_entries.id) gets shadowed.
  const [gs, memberCounts, fines] = await Promise.all([
    db
      .select({ groupId: groups.id, name: groups.name, archivedAt: groups.archivedAt })
      .from(groups)
      .orderBy(groups.name),
    db
      .select({ groupId: groupMembers.groupId, n: sql<number>`count(*)` })
      .from(groupMembers)
      .where(isNull(groupMembers.leftAt))
      .groupBy(groupMembers.groupId),
    db
      .select({ groupId: ledgerEntries.groupId, total: sql<number>`coalesce(sum(${ledgerEntries.amount}),0)` })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.kind, "fine"))
      .groupBy(ledgerEntries.groupId),
  ]);

  const mc = new Map(memberCounts.map((r) => [r.groupId, Number(r.n)]));
  const fc = new Map(fines.map((r) => [r.groupId, Number(r.total)]));
  return gs.map((g) => ({
    groupId: g.groupId,
    name: g.name,
    archived: g.archivedAt != null,
    memberCount: mc.get(g.groupId) ?? 0,
    totalFined: fc.get(g.groupId) ?? 0,
  }));
}

export interface GroupInspector {
  name: string;
  archived: boolean;
  members: { userId: string; name: string; role: string; joinedAt: string; leftAt: string | null }[];
  rulesTimeline: { effectiveFrom: string; typeKey: string; fineMode: string; fineAmount: number; currency: string }[];
  ledger: { id: number; fromName: string; toName: string; amount: number; currency: string; kind: string; periodStart: string | null; createdAt: Date }[];
}

export async function getGroupInspector(groupId: string): Promise<GroupInspector | null> {
  const [g] = await db
    .select({ name: groups.name, archivedAt: groups.archivedAt })
    .from(groups)
    .where(eq(groups.id, groupId));
  if (!g) return null;

  const [members, ledger] = await Promise.all([
    db
      .select({ userId: users.id, name: users.name, role: groupMembers.role, joinedAt: groupMembers.joinedAt, leftAt: groupMembers.leftAt })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, groupId)),
    db
      .select({
        id: ledgerEntries.id,
        fromName: sql<string>`(select name from users where id = ${ledgerEntries.fromUserId})`,
        toName: sql<string>`(select name from users where id = ${ledgerEntries.toUserId})`,
        amount: ledgerEntries.amount,
        currency: ledgerEntries.currency,
        kind: ledgerEntries.kind,
        periodStart: ledgerEntries.periodStart,
        createdAt: ledgerEntries.createdAt,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.groupId, groupId))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(100),
  ]);

  const rulesTimeline = await db
    .select({
      effectiveFrom: groupActivityRules.effectiveFrom,
      typeKey: groupActivityRules.typeKey,
      fineMode: groupActivityRules.fineMode,
      fineAmount: groupActivityRules.fineAmount,
      currency: groupActivityRules.currency,
    })
    .from(groupActivityRules)
    .where(eq(groupActivityRules.groupId, groupId))
    .orderBy(desc(groupActivityRules.effectiveFrom));

  return { name: g.name, archived: g.archivedAt != null, members, rulesTimeline, ledger };
}

// ---- Writes ---------------------------------------------------------------

export async function decideApproval(
  adminId: string,
  userId: string,
  approve: boolean,
): Promise<void> {
  const [changed] = await db
    .update(userApprovals)
    .set({ status: approve ? "approved" : "rejected", decidedAt: new Date(), decidedBy: adminId })
    .where(and(eq(userApprovals.userId, userId), eq(userApprovals.status, "pending")))
    .returning({ userId: userApprovals.userId });
  if (!changed) return;

  await recordEvent({
    userId: adminId,
    type: "admin.approval.decided",
    payload: { target_user_id: userId, approve },
  });

  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId));
  if (!target) return;

  await sendEmailBestEffort({
    actorId: adminId,
    kind: "approval",
    email: approvalEmail(target.email, approve),
    payload: { target_user_id: userId, approved: approve },
  });
}
// Only an admin (users.set_role) may call this; the action checks first. Keeps
// is_admin in sync with role='admin' for backward compatibility.
//
// Invariant: the app must never be left with zero admins. Demoting the last
// admin is rejected regardless of who does it, so a sole admin has to promote a
// replacement before stepping down. Recovery from an accidental zero-admin
// state is the same manual SQL that bootstrapped the first admin (see README).
export async function setRole(
  adminId: string,
  targetUserId: string,
  role: Role,
): Promise<void> {
  const targetRole = await getRole(targetUserId);
  if (targetRole === "admin" && role !== "admin" && (await approvedAdminCount()) <= 1) {
    throw new Error(
      "There must be at least one admin. Promote someone to admin before this change.",
    );
  }

  await db
    .update(userApprovals)
    .set({ role, isAdmin: role === "admin" })
    .where(eq(userApprovals.userId, targetUserId));
  await recordEvent({
    userId: adminId,
    type: "admin.role.changed",
    payload: { target_user_id: targetUserId, role },
  });
}

// Active (non-disabled) approved admins.
async function approvedAdminCount(): Promise<number> {
  return scalar(
    db
      .select({ n: sql`count(*)` })
      .from(userApprovals)
      .where(
        and(
          eq(userApprovals.status, "approved"),
          isNull(userApprovals.disabledAt),
          or(eq(userApprovals.role, "admin"), eq(userApprovals.isAdmin, true)),
        ),
      ),
  );
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// Soft-delete a user: block access and stop scoring by marking their active
// memberships left as of today (immutability-clean, balances survive). Nothing
// is removed. Cannot disable the last admin.
export async function disableUser(adminId: string, targetUserId: string): Promise<void> {
  if (adminId === targetUserId) {
    throw new Error("You cannot remove your own account. Ask another admin.");
  }
  if ((await getRole(targetUserId)) === "admin" && (await approvedAdminCount()) <= 1) {
    throw new Error("There must be at least one admin. Promote someone else first.");
  }
  const [disabled] = await db
    .update(userApprovals)
    .set({ disabledAt: new Date() })
    .where(and(eq(userApprovals.userId, targetUserId), isNull(userApprovals.disabledAt)))
    .returning({ userId: userApprovals.userId });
  if (!disabled) return;

  await db
    .update(groupMembers)
    .set({ leftAt: todayStr() })
    .where(and(eq(groupMembers.userId, targetUserId), isNull(groupMembers.leftAt)));
  // Kill their live sessions so access ends immediately, not just on the next
  // gated navigation. events.session_id is ON DELETE SET NULL, so history is
  // preserved.
  await db.delete(sessions).where(eq(sessions.userId, targetUserId));
  await recordEvent({
    userId: adminId,
    type: "admin.user.disabled",
    payload: { target_user_id: targetUserId },
  });

  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, targetUserId));
  if (!target) return;

  await sendEmailBestEffort({
    actorId: adminId,
    kind: "disabled",
    email: accountDisabledEmail(target.email),
    payload: { target_user_id: targetUserId },
  });
}
// Restore access. Memberships stay left; the user rejoins groups fresh.
export async function restoreUser(adminId: string, targetUserId: string): Promise<void> {
  await db
    .update(userApprovals)
    .set({ disabledAt: null })
    .where(eq(userApprovals.userId, targetUserId));
  await recordEvent({
    userId: adminId,
    type: "admin.user.restored",
    payload: { target_user_id: targetUserId },
  });
}

// Soft-delete a group: archive it so it stops accepting anything and stops
// being scored. Members, balances and history survive. Reversible.
export async function archiveGroup(adminId: string, groupId: string): Promise<void> {
  const now = new Date();
  await db.update(groups).set({ archivedAt: now }).where(eq(groups.id, groupId));
  await recordEvent({
    userId: adminId,
    type: "admin.group.archived",
    payload: { group_id: groupId },
  });
}

export async function restoreGroup(adminId: string, groupId: string): Promise<void> {
  await db.update(groups).set({ archivedAt: null }).where(eq(groups.id, groupId));
  await recordEvent({
    userId: adminId,
    type: "admin.group.restored",
    payload: { group_id: groupId },
  });
}

export async function runScoring(
  adminId: string,
  from?: string,
): Promise<{ users: number }> {
  const result = await scoreAll(from ? { from } : {});
  await recordEvent({ userId: adminId, type: "admin.scoring.ran", payload: { from: from ?? null, ...result } });
  return result;
}

export async function runVerify(adminId: string): Promise<Drift[]> {
  const drift = await verifyAll();
  await recordEvent({ userId: adminId, type: "admin.verify.ran", payload: { drift: drift.length } });
  return drift;
}
