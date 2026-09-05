import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  groups,
  groupMembers,
  users,
  activityScores,
  activityOutcomes,
  reputationDaily,
  evidence,
  ledgerEntries,
} from "@/db/schema";
import { getActivityType, joiningScore, START_SCORE, type DayReason } from "@/domain";
import { assertMember, memberRole } from "./membership";
import { acceptedTypes, sharesFor, ownerMoneyToggle } from "./sharing";
import { moneyOnFor } from "./app-config";
import { gracesIn, type GracePeriod } from "./grace";
import { cleanRunIn, cleanRunsIn } from "./clean-run";
import { globalScore } from "./scoring";

// Everything the group hub reads. Every query here is behind assertMember
// (invariant 10), and every one of them is scoped to what the member in
// question chose to share.

export interface GroupHeader {
  groupId: string;
  name: string;
  role: "owner" | "member";
  moneyOn: boolean;
}

export async function groupHeader(
  groupId: string,
  userId: string,
): Promise<GroupHeader | null> {
  const role = await memberRole(groupId, userId);
  const [g] = await db
    .select({ name: groups.name })
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.archivedAt)))
    .limit(1);
  if (!g) return null;
  // Three things decide whether money exists here: the app-wide switch, the
  // admin's per-group override, and the owner's own toggle (decision 18).
  const moneyOn = await moneyOnFor(
    groupId,
    await ownerMoneyToggle(groupId),
    new Date(),
  );
  return { groupId, name: g.name, role, moneyOn };
}

export interface MemberStanding {
  userId: string;
  name: string;
  you: boolean;
  score: number;
  /** Days running with nothing missed here, which is what the glow reads. */
  cleanDays: number;
  /** "Sleep 15 · Gym 24", the streaks of what they share here. */
  streaks: string;
  /** Set while this group is not counting them yet. They have no score here. */
  grace: GracePeriod | null;
}

/**
 * Every member with their standing here and the streaks of what they share.
 *
 * A member's streak for a type they do not share with this group is not shown,
 * because this group has no business knowing it exists.
 */
export async function memberStandings(
  groupId: string,
  viewerId: string,
): Promise<MemberStanding[]> {
  await assertMember(groupId, viewerId);

  const members = await db
    .select({ userId: users.id, name: users.name })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)));
  if (members.length === 0) return [];

  const ids = members.map((m) => m.userId);
  const [graces, cleanRuns] = await Promise.all([gracesIn(groupId), cleanRunsIn(groupId)]);
  const [scores, outcomes] = await Promise.all([
    db
      .select({
        userId: reputationDaily.userId,
        score: reputationDaily.score,
        day: reputationDaily.day,
      })
      .from(reputationDaily)
      .where(
        and(eq(reputationDaily.groupId, groupId), inArray(reputationDaily.userId, ids)),
      )
      .orderBy(desc(reputationDaily.day)),
    db
      .select({
        userId: activityOutcomes.userId,
        typeKey: activityOutcomes.typeKey,
        periodStart: activityOutcomes.periodStart,
        passed: activityOutcomes.passed,
      })
      .from(activityOutcomes)
      .where(eq(activityOutcomes.groupId, groupId))
      .orderBy(activityOutcomes.periodStart),
  ]);

  const latest = new Map<string, number>();
  for (const row of scores) {
    if (!latest.has(row.userId)) latest.set(row.userId, Number(row.score));
  }

  const out: MemberStanding[] = [];
  for (const m of members) {
    const shares = (await sharesFor(groupId, m.userId)).filter((s) => s.shared);
    const streaks = shares
      .map((s) => {
        const mine = outcomes.filter(
          (o) => o.userId === m.userId && o.typeKey === s.typeKey,
        );
        let run = 0;
        for (let i = mine.length - 1; i >= 0 && mine[i].passed; i -= 1) run += 1;
        return run > 0 ? `${getActivityType(s.typeKey).name} ${run}` : null;
      })
      .filter((s): s is string => s !== null)
      .join(" · ");

    out.push({
      userId: m.userId,
      name: m.name,
      you: m.userId === viewerId,
      score: latest.get(m.userId) ?? START_SCORE,
      cleanDays: cleanRuns.get(m.userId) ?? 0,
      streaks: streaks || "nothing shared yet",
      grace: graces.get(m.userId) ?? null,
    });
  }

  // Ranks are comparable and competitive by decision, so the list is ordered.
  // A member in grace has no score here yet and sits under everyone who does,
  // rather than at the bottom of the ladder on a number that is not theirs.
  return out.sort((a, b) => {
    if ((a.grace === null) !== (b.grace === null)) return a.grace === null ? -1 : 1;
    return b.score - a.score;
  });
}

export interface Movement {
  day: string;
  delta: number;
  reason: DayReason;
}

export interface Standing {
  score: number;
  ceiling: number;
  breadth: { shared: number; accepted: number };
  movements: Movement[];
  /** Days running with nothing missed here. Zero while in grace. */
  cleanDays: number;
  /**
   * Set while the group has not started counting this member. `score` is then
   * what they will start on rather than what they hold, and nothing they do
   * today can move it.
   */
  grace: GracePeriod | null;
}

export async function standingIn(
  groupId: string,
  userId: string,
): Promise<Standing> {
  await assertMember(groupId, userId);

  const rows = await db
    .select({
      day: reputationDaily.day,
      score: reputationDaily.score,
      delta: reputationDaily.delta,
      reason: reputationDaily.reason,
      ceiling: reputationDaily.ceiling,
    })
    .from(reputationDaily)
    .where(and(eq(reputationDaily.groupId, groupId), eq(reputationDaily.userId, userId)))
    .orderBy(desc(reputationDaily.day))
    .limit(7);

  const [accepted, shares, graces, cleanDays] = await Promise.all([
    acceptedTypes(groupId),
    sharesFor(groupId, userId),
    gracesIn(groupId),
    cleanRunIn(userId, groupId),
  ]);

  // In grace there is no stored day yet, so the number to show is the one the
  // group will open them on: their own record, flattened into 100..300
  // (decision 10). Showing the bare start score instead would be a number
  // nothing is ever going to use.
  const grace = graces.get(userId) ?? null;
  const opening = grace ? joiningScore(await globalScore(userId)) : START_SCORE;

  return {
    score: rows[0] ? Number(rows[0].score) : opening,
    ceiling: rows[0] ? Number(rows[0].ceiling) : 1000,
    breadth: {
      shared: shares.filter((s) => s.shared).length,
      accepted: accepted.length,
    },
    movements: rows.map((r) => ({
      day: r.day,
      delta: Number(r.delta),
      reason: r.reason as DayReason,
    })),
    cleanDays,
    grace,
  };
}

export interface WeekStats {
  done: number;
  of: number;
  byDay: { day: string; done: number; of: number }[];
  byMember: { name: string; done: number; of: number }[];
  byType: { typeKey: string; name: string; icon: string; percent: number }[];
}

/** How the group did over the last seven days. Counted, never read. */
export async function weekStats(groupId: string, viewerId: string): Promise<WeekStats> {
  await assertMember(groupId, viewerId);

  const from = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select({
      userId: activityOutcomes.userId,
      name: users.name,
      typeKey: activityOutcomes.typeKey,
      periodStart: activityOutcomes.periodStart,
      passed: activityOutcomes.passed,
    })
    .from(activityOutcomes)
    .innerJoin(users, eq(users.id, activityOutcomes.userId))
    .where(
      and(eq(activityOutcomes.groupId, groupId), gte(activityOutcomes.periodStart, from)),
    );

  const tally = <T extends string>(key: (r: (typeof rows)[number]) => T) => {
    const map = new Map<T, { done: number; of: number }>();
    for (const r of rows) {
      const k = key(r);
      const cur = map.get(k) ?? { done: 0, of: 0 };
      cur.of += 1;
      if (r.passed) cur.done += 1;
      map.set(k, cur);
    }
    return map;
  };

  const days = tally((r) => r.periodStart);
  const members = tally((r) => r.name);
  const types = tally((r) => r.typeKey);

  return {
    done: rows.filter((r) => r.passed).length,
    of: rows.length,
    byDay: [...days.entries()]
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    byMember: [...members.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.done / (b.of || 1) - a.done / (a.of || 1)),
    byType: [...types.entries()].map(([typeKey, v]) => {
      const type = getActivityType(typeKey);
      return {
        typeKey,
        name: type.name,
        icon: type.icon,
        percent: v.of === 0 ? 0 : Math.round((v.done / v.of) * 100),
      };
    }),
  };
}

export interface EvidenceItem {
  id: number;
  who: string;
  typeKey: string;
  typeName: string;
  icon: string;
  at: string;
  objectKey: string;
  /** Your own photo, which you cannot report. */
  mine: boolean;
}

/**
 * The evidence members chose to share here, newest first.
 *
 * Two filters, and both matter: the sharer must have `share_evidence` on for
 * that type, and the photo must not have been swept. A photo whose sharer has
 * since turned evidence off stops appearing at once.
 */
export async function groupEvidence(
  groupId: string,
  viewerId: string,
  // `since` is an INSTANT, not a period. A photo's periodStart is the period it
  // evidences, which for a weekly type is that week's Monday, so windowing on
  // it hid every gym photo taken after Tuesday from a "today and yesterday"
  // view. The tab already sorts and groups by confirmedAt; this now filters on
  // the same field.
  opts: { since?: Date; limit?: number } = {},
): Promise<EvidenceItem[]> {
  await assertMember(groupId, viewerId);

  const members = await db
    .select({ userId: groupMembers.userId, name: users.name })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)));

  const allowed = new Map<string, { name: string; types: Set<string> }>();
  for (const m of members) {
    const shares = await sharesFor(groupId, m.userId);
    const types = new Set(shares.filter((s) => s.shareEvidence).map((s) => s.typeKey));
    if (types.size > 0) allowed.set(m.userId, { name: m.name, types });
  }
  if (allowed.size === 0) return [];

  const rows = await db
    .select({
      id: evidence.id,
      userId: evidence.userId,
      typeKey: evidence.typeKey,
      periodStart: evidence.periodStart,
      confirmedAt: evidence.confirmedAt,
      objectKey: evidence.objectKey,
    })
    .from(evidence)
    .where(
      and(
        inArray(evidence.userId, [...allowed.keys()]),
        isNull(evidence.deletedAt),
        opts.since ? gte(evidence.confirmedAt, opts.since) : sql`true`,
      ),
    )
    .orderBy(desc(evidence.confirmedAt))
    .limit(opts.limit ?? 40);

  const out: EvidenceItem[] = [];
  for (const r of rows) {
    const who = allowed.get(r.userId);
    if (!who || !who.types.has(r.typeKey) || !r.confirmedAt) continue;
    const type = getActivityType(r.typeKey);
    out.push({
      id: r.id,
      who: who.name,
      mine: r.userId === viewerId,
      typeKey: r.typeKey,
      typeName: type.name,
      icon: type.icon,
      at: r.confirmedAt.toISOString(),
      objectKey: r.objectKey,
    });
  }
  return out;
}

/** How many periods this member has been scored on here, for the empty states. */
export async function hasHistory(groupId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(activityOutcomes)
    .where(eq(activityOutcomes.groupId, groupId));
  return (row?.n ?? 0) > 0;
}

/** A member's own scored periods, for the group stats empty state. */
export async function scoredPeriods(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(activityScores)
    .where(eq(activityScores.userId, userId));
  return row?.n ?? 0;
}

export interface GroupDebt {
  userId: string;
  name: string;
  currency: string;
  /** Positive: you owe them. Negative: they owe you. */
  netOwed: number;
}

/** Who owes whom inside one group, netted per person and currency. */
export async function groupBalances(
  groupId: string,
  viewerId: string,
): Promise<GroupDebt[]> {
  await assertMember(groupId, viewerId);

  const [members, rows] = await Promise.all([
    db
      .select({ userId: users.id, name: users.name })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, groupId)),
    db
      .select({
        fromUserId: ledgerEntries.fromUserId,
        toUserId: ledgerEntries.toUserId,
        amount: ledgerEntries.amount,
        currency: ledgerEntries.currency,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.groupId, groupId)),
  ]);

  const nameById = new Map(members.map((m) => [m.userId, m.name]));
  const net = new Map<string, number>();
  for (const r of rows) {
    if (r.fromUserId === viewerId) {
      const k = `${r.toUserId}|${r.currency}`;
      net.set(k, (net.get(k) ?? 0) + r.amount);
    } else if (r.toUserId === viewerId) {
      const k = `${r.fromUserId}|${r.currency}`;
      net.set(k, (net.get(k) ?? 0) - r.amount);
    }
  }

  const out: GroupDebt[] = [];
  for (const [k, netOwed] of net) {
    if (netOwed === 0) continue;
    const [userId, currency] = k.split("|");
    out.push({ userId, name: nameById.get(userId) ?? userId, currency, netOwed });
  }
  return out.sort((a, b) => b.netOwed - a.netOwed);
}
