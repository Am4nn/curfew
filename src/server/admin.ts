import { and, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  userApprovals,
  users,
  sessions,
  groups,
  groupMembers,
  groupInvites,
  activityScores,
  activityOutcomes,
  groupActivityRules,
  groupActivityTypes,
  ledgerEntries,
  events,
  userActivities,
  evidence,
  reputationDaily,
} from "@/db/schema";
import { resolveAt, getActivityType } from "@/domain";
import { recordEvent } from "./events";
import { accountDisabledEmail, approvalEmail, sendEmailBestEffort } from "./email";
import { userBalances } from "./groups";
import { scoreAll, rebuildAll } from "./scoring";
import { verifyAll, type Drift } from "./verify";
import { evidenceOps } from "./ops";
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

// The six tiles on .design/V3AdminOverview.dc.html, in that order.
export interface Overview {
  usersTotal: number;
  groupsTotal: number;
  pendingInvites: number; // group_invites still status='pending', not user approvals
  activitiesTracked: number; // user_activities rows currently switched on
  evidenceBytes: number;
  checkinsScoredPct: number | null; // null when there is nothing to score yet
}

// "LAST NIGHT'S RUN": there is no persisted run log (no cron writes a summary
// anywhere), so every row here is computed live, on read, from the derived
// tables the nightly job itself writes. That means these numbers describe the
// most recent closed period on file, not literally "last night" if the cron
// has not run since. See the Ops page for the same honesty tradeoff on
// "DRIFT, LAST RUN".
export interface LastRun {
  scoring: { periodsClosed: number; ok: true };
  reputation: { usersRecomputed: number; ok: true };
  retentionSweep: { photosDeleted: number; ok: true };
  /** Rows that differ from stored, of any kind: a period or a reputation day. */
  driftCheck: { periodsDiffer: number; ok: boolean };
}

export async function getOverview(): Promise<Overview> {
  const [usersTotal, groupsTotal, pendingInvites, activitiesTracked, evBytes, scoredPct] =
    await Promise.all([
      scalar(db.select({ n: sql`count(*)` }).from(users)),
      scalar(db.select({ n: sql`count(*)` }).from(groups).where(isNull(groups.archivedAt))),
      scalar(
        db
          .select({ n: sql`count(*)` })
          .from(groupInvites)
          .where(eq(groupInvites.status, "pending")),
      ),
      activitiesTrackedCount(),
      scalar(
        db
          .select({ n: sql`coalesce(sum(${evidence.bytes}),0)` })
          .from(evidence)
          .where(isNull(evidence.deletedAt)),
      ),
      checkinsScoredPct(),
    ]);

  return {
    usersTotal,
    groupsTotal,
    pendingInvites,
    activitiesTracked,
    evidenceBytes: evBytes,
    checkinsScoredPct: scoredPct,
  };
}

// user_activities is append-only (a switch is a new row, never an update), so
// "currently tracked" is the latest row at-or-before now for each (user,
// type), same resolution rule as resolveAt() uses per-user elsewhere, done
// here as one set query across everyone.
async function activitiesTrackedCount(): Promise<number> {
  const latest = db
    .select({
      userId: userActivities.userId,
      typeKey: userActivities.typeKey,
      maxAt: sql<Date>`max(${userActivities.effectiveAt})`.as("max_at"),
    })
    .from(userActivities)
    .where(sql`${userActivities.effectiveAt} <= now()`)
    .groupBy(userActivities.userId, userActivities.typeKey)
    .as("latest");

  return scalar(
    db
      .select({ n: sql`count(*)` })
      .from(latest)
      .innerJoin(
        userActivities,
        and(
          eq(userActivities.userId, latest.userId),
          eq(userActivities.typeKey, latest.typeKey),
          eq(userActivities.effectiveAt, latest.maxAt),
        ),
      )
      .where(eq(userActivities.enabled, true)),
  );
}

// What fraction of the check-in presses on record (grouped into the period
// each one belongs to) have a matching row in activity_scores. Not "does the
// app have check-ins", but "has the scoring pass caught up with them" — a
// period scored moments after its window closes reads at or near 100%; a
// backlog shows up as a drop. Null (rendered as "—") only when nobody has
// ever checked in.
async function checkinsScoredPct(): Promise<number | null> {
  // A flat query rather than a join against a derived subquery: Drizzle
  // cannot qualify a raw jsonb-extraction expression with its subquery's
  // alias once it crosses into an outer join condition, so a two-level
  // "distinct periods, then join activity_scores" version produced an
  // ambiguous "period_start" reference. Row-value DISTINCT and a correlated
  // EXISTS say the same thing in one query, with nothing to mis-qualify.
  const typeKeyExpr = sql`(${events.payload}->>'type_key')`;
  const periodStartExpr = sql`((${events.payload}->>'period_start')::date)`;

  const [row] = await db
    .select({
      total: sql<number>`count(distinct (${events.userId}, ${typeKeyExpr}, ${periodStartExpr}))`,
      scored: sql<number>`count(distinct (${events.userId}, ${typeKeyExpr}, ${periodStartExpr})) filter (where exists (
        select 1 from ${activityScores}
        where ${activityScores.userId} = ${events.userId}
          and ${activityScores.typeKey} = ${typeKeyExpr}
          and ${activityScores.periodStart} = ${periodStartExpr}
      ))`,
    })
    .from(events)
    .where(and(like(events.type, "checkin.%"), sql`${events.payload}->>'period_start' is not null`));

  const total = Number(row?.total ?? 0);
  if (total === 0) return null;
  return Math.round((Number(row?.scored ?? 0) / total) * 100);
}

/**
 * "LAST NIGHT'S RUN", read live from the derived tables the nightly job
 * writes. Scoring, reputation and the retention sweep have no failure state
 * to detect (no run log persists a fault), so they read "ok" whenever there
 * is data to show; the drift check is the one row backed by a real pass/fail.
 *
 * That row is what the JOB found, not what this page load finds. It used to
 * recompute seven days for every user on every Overview load, which is a lot
 * of work to answer "did last night go well", and it got slower the moment
 * verify started walking the ledger too. The nightly job records
 * `ops.verify.ran`; this reads it. Ops still verifies live, because that is
 * the screen you open to ask on purpose.
 */
export async function getLastRun(): Promise<LastRun> {
  const [scoringRow, reputationRow, ev, verifyRun] = await Promise.all([
    db
      .select({ periodEnd: activityScores.periodEnd, n: sql<number>`count(*)` })
      .from(activityScores)
      .groupBy(activityScores.periodEnd)
      .orderBy(desc(activityScores.periodEnd))
      .limit(1),
    db
      .select({ day: reputationDaily.day, n: sql<number>`count(distinct ${reputationDaily.userId})` })
      .from(reputationDaily)
      .groupBy(reputationDaily.day)
      .orderBy(desc(reputationDaily.day))
      .limit(1),
    evidenceOps(),
    db
      .select({ payload: events.payload })
      .from(events)
      .where(eq(events.type, "ops.verify.ran"))
      .orderBy(desc(events.occurredAt))
      .limit(1),
  ]);

  // Every kind, not just "score": counting only period drift reported "0
  // differ" on a window where Ops was listing a hundred reputation rows.
  //
  // No recorded run yet means the job has not run since this shipped, not that
  // everything is fine. It reads as ok with nothing to report, the same as the
  // three rows above, and Ops is a click away for a real answer.
  const recorded = (verifyRun[0]?.payload ?? {}) as { rows?: number };
  const periodsDiffer = Number(recorded.rows ?? 0);

  return {
    scoring: { periodsClosed: Number(scoringRow[0]?.n ?? 0), ok: true },
    reputation: { usersRecomputed: Number(reputationRow[0]?.n ?? 0), ok: true },
    retentionSweep: { photosDeleted: ev.lastSweep?.deleted ?? 0, ok: true },
    driftCheck: { periodsDiffer, ok: periodsDiffer === 0 },
  };
}

// ---- Users ----------------------------------------------------------------

export interface PendingUser {
  userId: string;
  email: string;
  name: string;
  requestedAt: Date;
  /** Who invited them, and into which group — null when nothing traces back
   * to an invite (a person can also sign up unprompted). */
  invite: { invitedByName: string; groupName: string } | null;
}

// Just the count, for the header's pending-work dot (decision 33) — no need
// to pull every pending row to know whether there's at least one.
export async function pendingApprovalCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userApprovals)
    .where(eq(userApprovals.status, "pending"));
  return row?.n ?? 0;
}

export async function listPendingApprovals(): Promise<PendingUser[]> {
  const rows = await db
    .select({
      userId: userApprovals.userId,
      email: users.email,
      name: users.name,
      requestedAt: userApprovals.requestedAt,
    })
    .from(userApprovals)
    .innerJoin(users, eq(users.id, userApprovals.userId))
    .where(eq(userApprovals.status, "pending"));
  if (rows.length === 0) return [];

  // A pending approval traces to an invite by email match: whoever invited
  // this address into a group, most recent first. Not every approval has
  // one — signing up needs no invite — so this is a best-effort join, never
  // a requirement.
  const emails = [...new Set(rows.map((r) => r.email))];
  const invites = await db
    .select({
      email: groupInvites.email,
      groupName: groups.name,
      invitedByName: users.name,
      createdAt: groupInvites.createdAt,
    })
    .from(groupInvites)
    .innerJoin(groups, eq(groups.id, groupInvites.groupId))
    .innerJoin(users, eq(users.id, groupInvites.invitedBy))
    .where(inArray(groupInvites.email, emails))
    .orderBy(desc(groupInvites.createdAt));

  const byEmail = new Map<string, { invitedByName: string; groupName: string }>();
  for (const inv of invites) {
    if (!byEmail.has(inv.email)) {
      byEmail.set(inv.email, { invitedByName: inv.invitedByName, groupName: inv.groupName });
    }
  }

  return rows.map((r) => ({ ...r, invite: byEmail.get(r.email) ?? null }));
}

export interface AdminUserRow {
  userId: string;
  name: string;
  email: string;
  status: string;
  role: string;
  disabled: boolean;
  // active | pending | banned — the three states .design/V3AdminUsers.dc.html
  // filters and labels by. Collapses raw status + disabled into one field so
  // the screen doesn't re-derive it.
  displayStatus: string;
  groupCount: number;
  // Distinct type_key with the latest (by effective_at) user_activities row
  // enabled=true, i.e. what they track right now, not every row ever written.
  activityCount: number;
  requestedAt: Date | null;
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
      displayStatus: sql<string>`case
        when ${userApprovals.disabledAt} is not null then 'banned'
        when coalesce(${userApprovals.status}, 'pending') = 'pending' then 'pending'
        when coalesce(${userApprovals.status}, 'pending') = 'approved' then 'active'
        else 'banned'
      end`,
      // count(*) comes back from Postgres as bigint, which the driver hands
      // back as a string — cast to int, or `=== 1` singular/plural checks on
      // these downstream silently always take the plural branch.
      groupCount: sql<number>`(select count(*)::int from group_members gm where gm.user_id = ${users.id} and gm.left_at is null)`,
      // One correlated subquery, same style as groupCount/lastEventAt below:
      // one round trip for the whole directory, not one query per user.
      activityCount: sql<number>`(
        select count(*)::int from (
          select distinct on (ua.type_key) ua.enabled
          from user_activities ua
          where ua.user_id = ${users.id}
          order by ua.type_key, ua.effective_at desc
        ) latest
        where latest.enabled
      )`,
      requestedAt: userApprovals.requestedAt,
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
  recentOutcomes: { periodStart: string; groupName: string; typeKey: string; passed: boolean; fineAmount: number; currency: string }[];
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
  // Distinct type_key currently accepted (latest group_activity_types row,
  // resolved the same way sharing.acceptedTypes() resolves it for a member).
  typeCount: number;
  ownerName: string | null;
  totalFined: number;
  archived: boolean;
}

export async function listAllGroups(): Promise<AdminGroupRow[]> {
  // Aggregated separately then merged, rather than correlated subqueries: an
  // unqualified outer column reference inside a subquery whose table also has
  // that column name (ledger_entries.id) gets shadowed.
  const [gs, memberCounts, fines, owners, typeRows] = await Promise.all([
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
    db
      .select({ groupId: groupMembers.groupId, name: users.name })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(and(eq(groupMembers.role, "owner"), isNull(groupMembers.leftAt))),
    // Whole table, one query, resolved in memory below — same tradeoff
    // moneyOverrides() in group-controls.ts makes for the same reason: it is
    // append-only and small, and resolving "as of now" per group needs the
    // full history, not just the latest row (Postgres can't pick "latest per
    // group+type" without either this or a window function per group).
    db
      .select({
        id: groupActivityTypes.id,
        groupId: groupActivityTypes.groupId,
        typeKey: groupActivityTypes.typeKey,
        accepted: groupActivityTypes.accepted,
        effectiveAt: groupActivityTypes.effectiveAt,
      })
      .from(groupActivityTypes),
  ]);

  const mc = new Map(memberCounts.map((r) => [r.groupId, Number(r.n)]));
  const fc = new Map(fines.map((r) => [r.groupId, Number(r.total)]));
  const oc = new Map(owners.map((r) => [r.groupId, r.name]));

  const now = new Date();
  const rowsByGroup = new Map<string, typeof typeRows>();
  for (const row of typeRows) {
    const arr = rowsByGroup.get(row.groupId);
    if (arr) arr.push(row);
    else rowsByGroup.set(row.groupId, [row]);
  }
  const tc = new Map<string, number>();
  for (const [groupId, rows] of rowsByGroup) {
    let count = 0;
    for (const typeKey of new Set(rows.map((r) => r.typeKey))) {
      const resolved = resolveAt(rows.filter((r) => r.typeKey === typeKey), now);
      if (resolved?.accepted) count++;
    }
    tc.set(groupId, count);
  }

  return gs.map((g) => ({
    groupId: g.groupId,
    name: g.name,
    archived: g.archivedAt != null,
    memberCount: mc.get(g.groupId) ?? 0,
    typeCount: tc.get(g.groupId) ?? 0,
    ownerName: oc.get(g.groupId) ?? null,
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
        fromName: ledgerEntries.fromUserName,
        toName: ledgerEntries.toUserName,
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

export async function runVerify(
  adminId: string,
  opts: { from?: string; to?: string } = {},
): Promise<Drift[]> {
  const drift = await verifyAll(opts);
  await recordEvent({
    userId: adminId,
    type: "admin.verify.ran",
    payload: { from: opts.from ?? null, to: opts.to ?? null, drift: drift.length },
  });
  return drift;
}

/**
 * Rewrites activity_scores, activity_outcomes and reputation_daily for the
 * given range, from events. Never writes ledger_entries (fines:false skips
 * writeFines entirely) and never writes events (scoreUser only reads them).
 * The mock's own caption is the constraint: "Rebuild rewrites derived tables
 * only. Events and ledger entries are never touched."
 */
export async function runRebuild(
  adminId: string,
  opts: { from?: string; to?: string } = {},
): Promise<{ users: number; scores: number; outcomes: number }> {
  const result = await rebuildAll(opts);
  await recordEvent({
    userId: adminId,
    type: "admin.rebuild.ran",
    payload: { from: opts.from ?? null, to: opts.to ?? null, ...result },
  });
  return result;
}

// ---- Ops: DRIFT, LAST RUN --------------------------------------------------

export interface DriftRow {
  userName: string;
  typeName: string; // an activity type's display name, or "Reputation"
  date: string; // yyyy-mm-dd
  detail: string; // "stored X, recomputed Y"
}

/**
 * The Ops page's "DRIFT, LAST RUN" list. There is no persisted run log (same
 * tradeoff as Overview's LAST NIGHT'S RUN), so this recomputes live for the
 * given range every time the Ops page is opened or its range changes — "last
 * run" means "as of this read", not a nightly job's history.
 */
export async function getDriftReport(
  opts: { from?: string; to?: string } = {},
): Promise<{ rows: DriftRow[]; total: number }> {
  const drift = await verifyAll(opts);
  if (drift.length === 0) return { rows: [], total: 0 };

  const userIds = [...new Set(drift.map((d) => d.userId))];
  const people = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds));
  const nameOf = new Map(people.map((p) => [p.id, p.name]));

  const rows = drift.slice(0, 20).map((d): DriftRow => {
    const userName = nameOf.get(d.userId) ?? "unknown";
    if (d.kind === "score") {
      const [typeKey, periodStart] = d.key.split("|");
      return {
        userName,
        typeName: activityTypeName(typeKey),
        date: periodStart,
        detail: describeScoreDrift(d),
      };
    }
    const [, day] = d.key.split("|");
    return { userName, typeName: "Reputation", date: day, detail: describeReputationDrift(d) };
  });

  return { rows, total: drift.length };
}

function activityTypeName(typeKey: string): string {
  try {
    return getActivityType(typeKey).name;
  } catch {
    return typeKey;
  }
}

function describeScoreDrift(d: Drift): string {
  if (d.field === "*") return `no stored score, recomputed ${d.computed ? "pass" : "fail"}`;
  if (d.field === "passed") {
    return `stored ${d.stored ? "pass" : "fail"}, recomputed ${d.computed ? "pass" : "fail"}`;
  }
  if (d.field === "settling") {
    return `stored settling=${String(d.stored)}, recomputed settling=${String(d.computed)}`;
  }
  return `${d.field}: stored ${String(d.stored)}, recomputed ${String(d.computed)}`;
}

function describeReputationDrift(d: Drift): string {
  if (d.field === "*") return `no stored reputation, recomputed ${String(d.computed)}`;
  if (d.field === "score") return `stored ${String(d.stored)}, recomputed ${String(d.computed)}`;
  if (d.field === "reason") {
    return `stored reason ${String(d.stored)}, recomputed reason ${String(d.computed)}`;
  }
  return `${d.field}: stored ${String(d.stored)}, recomputed ${String(d.computed)}`;
}
