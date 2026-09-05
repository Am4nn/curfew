// Building a world for one scenario, and reading back what the engine made of
// it.
//
// This is a seed script's toolkit, not the app's write path: it inserts events
// directly, the way `seed-local.ts` does, because a scenario is a history that
// already happened rather than a session of presses. Everything AFTER the
// events is the real engine: `scoreAll` scores, closes, moves reputation and
// settles fines exactly as the nightly job does, and the assertions read the
// tables it wrote.
import { DateTime } from "luxon";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  userApprovals,
  userSettings,
  userActivities,
  userActivityConfig,
  activityScores,
  activityStreaks,
  reputationDaily,
  activityOutcomes,
  ledgerEntries,
  finePostings,
  events,
  groups,
  groupMembers,
  groupActivityTypes,
  groupActivityRules,
  groupSettings,
  memberShares,
  consentRecords,
} from "@/db/schema";
import {
  periodStart,
  periodUnit,
  rankFor,
  type Schedule,
  type DayBoundary,
} from "@/domain";
import { CONSENT_VERSION } from "@/server/consent";

export const TZ = "Asia/Kolkata";
export const EPOCH = "2000-01-01";

/** Every scenario ends on this day, so a report is the same every run. */
export const TODAY = DateTime.fromISO("2026-09-05", { zone: TZ }).startOf("day");

export const day = (offsetFromToday: number) =>
  TODAY.plus({ days: offsetFromToday }).toFormat("yyyy-MM-dd");

export interface ScheduleShape {
  schedule: Schedule;
  dayBoundary: DayBoundary;
  grace: number;
}

let idem = 0;

export async function wipe(): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE
    ledger_entries, fine_postings, activity_outcomes, activity_scores,
    activity_streaks, reputation_daily, evidence, reports, events,
    user_activity_config, user_activities, user_settings,
    group_invites, group_members, member_shares, group_activity_rules,
    group_activity_types, group_settings, groups,
    notice_acks, notices, consent_records,
    user_approvals, sessions, accounts, users
    RESTART IDENTITY CASCADE`);
  idem = 0;
}

export async function person(id: string, name: string): Promise<void> {
  await db.insert(users).values({
    id,
    name,
    email: `${id}@sim.local`,
    emailVerified: true,
    image: null,
  });
  await db.insert(userApprovals).values({
    userId: id,
    status: "approved",
    isAdmin: false,
    role: "member",
    requestedAt: new Date(),
    decidedAt: new Date(),
    decidedBy: id,
  });
  await db.insert(consentRecords).values({ userId: id, version: CONSENT_VERSION });
}

export async function defaultTimezone(): Promise<void> {
  await db.insert(userSettings).values({ userId: null, timezone: TZ, effectiveFrom: EPOCH });
}

/** Put one person in their own zone, from the beginning of time. */
export async function timezoneFor(userId: string, zone: string): Promise<void> {
  await db.insert(userSettings).values({ userId, timezone: zone, effectiveFrom: EPOCH });
}

/** A check-in at a wall-clock time in a NAMED zone rather than the default. */
export async function checkinIn(
  zone: string,
  userId: string,
  typeKey: string,
  step: string,
  date: string,
  time: string,
  schedule: Pick<ScheduleShape, "schedule" | "dayBoundary">,
  evidence: Record<string, unknown> = {},
): Promise<string> {
  idem += 1;
  const at = DateTime.fromISO(`${date}T${time}`, { zone }).toJSDate();
  const period = periodStart(at, zone, {
    unit: periodUnit(schedule.schedule),
    boundary: schedule.dayBoundary,
  });
  await db.insert(events).values({
    userId,
    type: `checkin.${typeKey}.${step}`,
    payload: {
      type_key: typeKey,
      step,
      period_start: period,
      idem: `sim-${idem}`,
      evidence,
    },
    occurredAt: at,
  });
  return period;
}

/** Track a type from a date. Both rows, since v3 decision 83 needs both. */
export async function track(
  userId: string,
  typeKey: string,
  schedule: ScheduleShape,
  config: unknown,
  from: string,
): Promise<void> {
  await db.insert(userActivityConfig).values({
    userId,
    typeKey,
    config: { schedule, config },
    effectiveFrom: from,
  });
  await db.insert(userActivities).values({
    userId,
    typeKey,
    enabled: true,
    effectiveAt: DateTime.fromISO(from, { zone: TZ }).toJSDate(),
  });
}

/**
 * Track a type from a date IN A NAMED ZONE, the way `checkinIn` presses in one.
 *
 * `track` above starts the activity at midnight in the default zone, whoever is
 * tracking it. That is fine for one person and wrong for a scenario comparing
 * several: four people in four zones all switching on at the same INSTANT began
 * on different local dates, so their settling weeks covered different days, and
 * the comparison was measuring the fixture rather than the engine.
 *
 * The engine reads the switch instant in the member's own zone, because that is
 * the day they started. So a scenario that wants "the same habit, in four
 * places" has to start each of them at their own local midnight.
 */
export async function trackIn(
  zone: string,
  userId: string,
  typeKey: string,
  schedule: ScheduleShape,
  config: unknown,
  from: string,
): Promise<void> {
  await db.insert(userActivityConfig).values({
    userId,
    typeKey,
    config: { schedule, config },
    effectiveFrom: from,
  });
  await db.insert(userActivities).values({
    userId,
    typeKey,
    enabled: true,
    effectiveAt: DateTime.fromISO(from, { zone }).toJSDate(),
  });
}

/** Stop tracking, from a date. Append-only, like the app does it. */
export async function untrack(
  userId: string,
  typeKey: string,
  from: string,
): Promise<void> {
  await db.insert(userActivities).values({
    userId,
    typeKey,
    enabled: false,
    effectiveAt: DateTime.fromISO(from, { zone: TZ }).toJSDate(),
  });
}

/** One recorded check-in, at a wall-clock time on a date in the user's zone. */
export async function checkin(
  userId: string,
  typeKey: string,
  step: string,
  date: string,
  time: string,
  schedule: Pick<ScheduleShape, "schedule" | "dayBoundary">,
  evidence: Record<string, unknown> = {},
): Promise<string> {
  idem += 1;
  const at = DateTime.fromISO(`${date}T${time}`, { zone: TZ }).toJSDate();
  const period = periodStart(at, TZ, {
    unit: periodUnit(schedule.schedule),
    boundary: schedule.dayBoundary,
  });
  await db.insert(events).values({
    userId,
    type: `checkin.${typeKey}.${step}`,
    payload: {
      type_key: typeKey,
      step,
      period_start: period,
      idem: `sim-${idem}`,
      evidence,
    },
    occurredAt: at,
  });
  return period;
}

export async function group(
  id: string,
  name: string,
  members: { id: string; role: "owner" | "member"; joinedAt: string; leftAt?: string }[],
): Promise<void> {
  await db.insert(groups).values({ id, name, createdBy: members[0].id });
  for (const m of members) {
    await db.insert(groupMembers).values({
      groupId: id,
      userId: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt ?? null,
    });
  }
}

/** The group accepts a type, optionally with a fine, from a date. */
export async function accepts(
  groupId: string,
  typeKey: string,
  opts: { fine?: number; currency?: string; from: string; by: string },
): Promise<void> {
  // effectiveAt matters and defaults to now(). Left at the default, the group
  // accepts nothing on every day of the history, breadth resolves to 1 because
  // there is nothing to be narrow within, and the ceiling reads 1000 for a
  // member sharing one type of three. The simulation found that as a group
  // score of 730 under a ceiling of 500, which is the engine's effective dating
  // working exactly as it should against a badly dated fixture.
  await db.insert(groupActivityTypes).values({
    groupId,
    typeKey,
    accepted: true,
    changedBy: opts.by,
    effectiveAt: DateTime.fromISO(opts.from, { zone: TZ }).toJSDate(),
  });
  if (opts.fine !== undefined) {
    await db.insert(groupActivityRules).values({
      groupId,
      typeKey,
      fineMode: "flat",
      fineAmount: opts.fine,
      currency: opts.currency ?? "INR",
      effectiveFrom: opts.from,
      changedBy: opts.by,
    });
  }
}

/** The owner's money toggle, off by default (decision 18). */
export async function money(
  groupId: string,
  on: boolean,
  from: string,
  by: string,
): Promise<void> {
  await db.insert(groupSettings).values({
    groupId,
    key: "money_owner",
    value: on,
    changedBy: by,
    effectiveAt: DateTime.fromISO(from, { zone: TZ }).toJSDate(),
  });
}

/** A member's share of one type with one group, from a date. Append-only. */
export async function share(
  groupId: string,
  userId: string,
  typeKey: string,
  shared: boolean,
  from: string,
): Promise<void> {
  await db.insert(memberShares).values({
    groupId,
    userId,
    typeKey,
    shared,
    shareEvidence: shared,
    changedBy: userId,
    effectiveAt: DateTime.fromISO(from, { zone: TZ }).toJSDate(),
  });
}

// ---------------------------------------------------------------------------
// Reading back what the engine made of it
// ---------------------------------------------------------------------------

export interface Standing {
  streak: number;
  best: number;
  graceSpent: Record<string, number>;
}

export interface DayScore {
  day: string;
  score: number;
  delta: number;
  reason: string;
  ceiling: number;
  completion: number | null;
}

export async function streakOf(userId: string, typeKey: string): Promise<Standing | null> {
  const [row] = await db
    .select()
    .from(activityStreaks)
    .where(sql`${activityStreaks.userId} = ${userId} AND ${activityStreaks.typeKey} = ${typeKey}`);
  return row
    ? { streak: row.current, best: row.best, graceSpent: row.graceSpent ?? {} }
    : null;
}

export async function curveOf(
  userId: string,
  groupId: string | null,
): Promise<DayScore[]> {
  const rows = await db
    .select()
    .from(reputationDaily)
    .where(
      groupId === null
        ? sql`${reputationDaily.userId} = ${userId} AND ${reputationDaily.groupId} IS NULL`
        : sql`${reputationDaily.userId} = ${userId} AND ${reputationDaily.groupId} = ${groupId}`,
    )
    .orderBy(reputationDaily.day);
  return rows.map((r) => ({
    day: r.day,
    score: Number(r.score),
    delta: Number(r.delta),
    reason: r.reason,
    ceiling: Number(r.ceiling),
    completion: r.completion === null ? null : Number(r.completion),
  }));
}

export async function finalScore(userId: string, groupId: string | null): Promise<number> {
  const curve = await curveOf(userId, groupId);
  return curve.at(-1)?.score ?? 0;
}

export async function rankOf(userId: string, groupId: string | null): Promise<string> {
  return rankFor(await finalScore(userId, groupId)).name;
}

export interface LedgerLine {
  from: string;
  to: string;
  amount: number;
  currency: string;
  kind: string;
  typeKey: string | null;
  periodStart: string | null;
}

export async function ledgerOf(groupId: string): Promise<LedgerLine[]> {
  const rows = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.groupId, groupId))
    .orderBy(ledgerEntries.id);
  return rows.map((r) => ({
    from: r.fromUserId,
    to: r.toUserId,
    amount: r.amount,
    currency: r.currency,
    kind: r.kind,
    typeKey: r.typeKey,
    periodStart: r.periodStart,
  }));
}

export async function postingsOf(groupId: string): Promise<
  { user: string; typeKey: string; periodStart: string; amount: number }[]
> {
  const rows = await db
    .select()
    .from(finePostings)
    .where(eq(finePostings.groupId, groupId))
    .orderBy(finePostings.periodStart);
  return rows.map((r) => ({
    user: r.fromUserId,
    typeKey: r.typeKey,
    periodStart: r.periodStart,
    amount: r.amount,
  }));
}

/** Net position per person in one group: positive means they owe. */
export async function balancesOf(groupId: string): Promise<Map<string, number>> {
  const net = new Map<string, number>();
  for (const l of await ledgerOf(groupId)) {
    net.set(l.from, (net.get(l.from) ?? 0) + l.amount);
    net.set(l.to, (net.get(l.to) ?? 0) - l.amount);
  }
  return net;
}

export async function outcomesOf(
  groupId: string,
): Promise<{ user: string; typeKey: string; periodStart: string; passed: boolean; fine: number }[]> {
  const rows = await db
    .select()
    .from(activityOutcomes)
    .where(eq(activityOutcomes.groupId, groupId))
    .orderBy(activityOutcomes.periodStart);
  return rows.map((r) => ({
    user: r.userId,
    typeKey: r.typeKey,
    periodStart: r.periodStart,
    passed: r.passed,
    fine: r.fineAmount,
  }));
}

export async function scoresOf(
  userId: string,
  typeKey: string,
): Promise<{ periodStart: string; passed: boolean; settling: boolean }[]> {
  const rows = await db
    .select()
    .from(activityScores)
    .where(sql`${activityScores.userId} = ${userId} AND ${activityScores.typeKey} = ${typeKey}`)
    .orderBy(activityScores.periodStart);
  return rows.map((r) => ({
    periodStart: r.periodStart,
    passed: r.passed,
    settling: r.settling,
  }));
}
