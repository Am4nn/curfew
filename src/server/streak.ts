import { DateTime } from "luxon";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityScores, activityStreaks, events } from "@/db/schema";
import {
  streakOver,
  periodUnit,
  periodStart,
  daysDoneIn,
  EMPTY_STREAK,
  type StreakDay,
  type StreakState,
  type Checkin,
} from "@/domain";
import { getUserActivity, listUserActivities } from "./activities";
import { resolveUserTimezone } from "./config";
import { now } from "@/lib/clock";

// The stored streak.
//
// A streak is the one number in the app that moves the instant you press a
// button, and it used to be the one that cost the most to read: every screen
// loaded every closed period for the type and walked them. Worse, it walked
// the wrong thing. `streakOver` counts DAYS, and it was handed one row per
// PERIOD, so a weekly type arrived as a single Monday, fell below its own
// three-a-week minimum, and reported three passed gym weeks as a streak of 1
// while spending grace on weeks that had passed.
//
// So the number is stored, and three things maintain it:
//
//   - the PRESS bumps it, which is what makes it instant,
//   - the CLOSE rebuilds it once per activity-day, which is what makes a missed
//     day, a missed press or a missed night correct itself,
//   - `verify` diffs the stored number against a rebuild, which is what says so
//     when none of that worked.
//
// events stays the truth and this stays a cache (invariant 1). There is no day
// log beside it: `events` already is one, with `events_one_checkin_idx`
// enforcing one check-in per user, type, period and idempotency key.

export interface StoredStreak {
  current: number;
  best: number;
  graceSpent: Record<string, number>;
  closedThrough: string | null;
  weekStart: string | null;
  weekSessions: number;
}

const iso = (d: DateTime) => d.toFormat("yyyy-MM-dd");
const addDays = (date: string, n: number) =>
  iso(DateTime.fromISO(date, { zone: "utc" }).plus({ days: n }));

function mondayOf(date: string): string {
  const d = DateTime.fromISO(date, { zone: "utc" });
  return iso(d.minus({ days: d.weekday - 1 }));
}

function dayList(from: string, to: string): string[] {
  const out: string[] = [];
  let d = DateTime.fromISO(from, { zone: "utc" });
  const end = DateTime.fromISO(to, { zone: "utc" });
  while (d <= end) {
    out.push(iso(d));
    d = d.plus({ days: 1 });
  }
  return out;
}

/** The stored row, or null when this type has never been counted. */
export async function readStreak(
  userId: string,
  typeKey: string,
): Promise<StoredStreak | null> {
  const [row] = await db
    .select()
    .from(activityStreaks)
    .where(and(eq(activityStreaks.userId, userId), eq(activityStreaks.typeKey, typeKey)));
  if (!row) return null;
  return {
    current: row.current,
    best: row.best,
    graceSpent: row.graceSpent ?? {},
    closedThrough: row.closedThrough,
    weekStart: row.weekStart,
    weekSessions: row.weekSessions,
  };
}

/**
 * Every activity-day for one type, in order, with whether it was done.
 *
 * This is the shape `streakOver` was always asking for and never given. A
 * DAILY type's activity-day is its period, so the stored score answers
 * directly. A WEEKLY type's period is a week and its days are whichever days
 * the module counted, so the module is asked (`daysDoneIn`) and every day of
 * the week is emitted, done or not.
 *
 * Only closed periods appear, because a period still in flight has not been
 * judged and a week in flight is handled by `streakOver`'s own asOf.
 */
async function activityDays(
  userId: string,
  typeKey: string,
  unit: "day" | "week",
  timezone: string,
  inFlight: { period: string; config: unknown } | null,
): Promise<{ days: StreakDay[]; closedThrough: string | null }> {
  const scored = await db
    .select({
      periodStart: activityScores.periodStart,
      periodEnd: activityScores.periodEnd,
      passed: activityScores.passed,
    })
    .from(activityScores)
    .where(and(eq(activityScores.userId, userId), eq(activityScores.typeKey, typeKey)))
    .orderBy(activityScores.periodStart);
  if (scored.length === 0) return { days: [], closedThrough: null };

  // The last day any closed period covers. A week scored on its Monday has
  // been judged through the Sunday after it.
  const closedThrough = scored
    .map((s) => addDays(s.periodEnd, -1))
    .reduce((a, b) => (a > b ? a : b));

  // Whatever the period in flight has ALREADY earned.
  //
  // The press counts a day the moment it is done, so a rebuild that only looks
  // at closed periods would report a smaller number than the counter holds and
  // `verify` would call the counter wrong every evening. It found exactly that.
  //
  // Only days that are DONE are added, never a day that is merely not done yet.
  // A day still in progress has not been missed, and marking it false would end
  // a run at breakfast.
  const live = inFlight ? await daysDoneInFlight(userId, typeKey, timezone, inFlight) : [];

  if (unit === "day") {
    const days = scored.map((s) => ({ date: s.periodStart, done: s.passed }));
    for (const date of live) if (date > closedThrough) days.push({ date, done: true });
    return { days, closedThrough };
  }

  // A weekly type: ask the module which days of each week it counted.
  const rows = await db
    .select({ occurredAt: events.occurredAt, payload: events.payload })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        like(events.type, `checkin.${typeKey}.%`),
        sql`${events.payload}->>'period_start' >= ${scored[0].periodStart}`,
      ),
    );

  const byPeriod = new Map<string, Checkin<unknown>[]>();
  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const period = String(payload.period_start);
    const list = byPeriod.get(period) ?? [];
    list.push({ step: String(payload.step), at: row.occurredAt, evidence: payload.evidence });
    byPeriod.set(period, list);
  }

  const activity = await getUserActivity(userId, typeKey);
  const done = new Set<string>();
  for (const s of scored) {
    const counted = daysDoneIn(typeKey, {
      periodStart: s.periodStart,
      timezone,
      config: activity?.config,
      checkins: byPeriod.get(s.periodStart) ?? [],
    });
    for (const day of counted) done.add(day);
  }

  const first = scored[0].periodStart;
  const last = addDays(scored[scored.length - 1].periodEnd, -1);
  const days = dayList(first, last).map((date) => ({ date, done: done.has(date) }));
  // The week in flight adds its days as they happen (decision 77). It is not
  // judged: `closedThrough` is what streakOver measures a week's end against,
  // so this week stays in flight until its Sunday has closed.
  for (const date of live) if (date > closedThrough) days.push({ date, done: true });
  return { days, closedThrough };
}

/** The days the module counts in a period that has not closed yet. */
async function daysDoneInFlight(
  userId: string,
  typeKey: string,
  timezone: string,
  inFlight: { period: string; config: unknown },
): Promise<string[]> {
  const rows = await db
    .select({ occurredAt: events.occurredAt, payload: events.payload })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        like(events.type, `checkin.${typeKey}.%`),
        sql`${events.payload}->>'period_start' = ${inFlight.period}`,
      ),
    );
  if (rows.length === 0) return [];

  return daysDoneIn(typeKey, {
    periodStart: inFlight.period,
    timezone,
    config: inFlight.config,
    checkins: rows.map((row) => {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      return { step: String(payload.step), at: row.occurredAt, evidence: payload.evidence };
    }),
  });
}

/**
 * Rebuild the counter from events and store it.
 *
 * The counter is a cache, so this is what makes it repairable: a press that
 * never landed, a night the job missed, a bug in the bump. It reads one type's
 * scores and one type's check-ins, which is bounded by that type's history and
 * nothing else. `verify` calls it without writing, to diff.
 */
export async function rebuildStreak(
  userId: string,
  typeKey: string,
  opts: { write?: boolean } = {},
): Promise<StoredStreak | null> {
  const activity = await getUserActivity(userId, typeKey);
  if (!activity) return null;

  const instant = await now();
  const timezone = await resolveUserTimezone(userId, iso(DateTime.fromJSDate(instant, { zone: "utc" })));
  const unit = periodUnit(activity.schedule.schedule);
  const inFlight = {
    period: periodStart(instant, timezone, {
      unit,
      boundary: activity.schedule.dayBoundary,
    }),
    config: activity.config,
  };
  const { days, closedThrough } = await activityDays(
    userId,
    typeKey,
    unit,
    timezone,
    inFlight,
  );

  const result = streakOver(
    days,
    activity.schedule.schedule,
    activity.schedule.grace,
    EMPTY_STREAK,
    closedThrough ?? undefined,
  );

  // The week in flight, so a press can add to it without re-reading history.
  const today = iso(DateTime.fromJSDate(instant, { zone: timezone }));
  const weekStart = unit === "week" ? mondayOf(today) : null;
  const weekSessions =
    weekStart === null
      ? 0
      : days.filter((d) => d.done && d.date >= weekStart).length;

  const stored: StoredStreak = {
    current: result.current,
    best: result.best,
    graceSpent: result.graceSpent,
    closedThrough,
    weekStart,
    weekSessions,
  };

  if (opts.write !== false) await writeStreak(userId, typeKey, stored, days.at(-1)?.date ?? null);
  return stored;
}

async function writeStreak(
  userId: string,
  typeKey: string,
  s: StoredStreak,
  lastDay: string | null,
): Promise<void> {
  await db
    .insert(activityStreaks)
    .values({
      userId,
      typeKey,
      current: s.current,
      best: s.best,
      lastDay,
      weekStart: s.weekStart,
      weekSessions: s.weekSessions,
      graceSpent: s.graceSpent,
      closedThrough: s.closedThrough,
    })
    .onConflictDoUpdate({
      target: [activityStreaks.userId, activityStreaks.typeKey],
      set: {
        current: sql`excluded.current`,
        best: sql`excluded.best`,
        lastDay: sql`excluded.last_day`,
        weekStart: sql`excluded.week_start`,
        weekSessions: sql`excluded.week_sessions`,
        graceSpent: sql`excluded.grace_spent`,
        closedThrough: sql`excluded.closed_through`,
        updatedAt: sql`now()`,
      },
    });
}

/**
 * A press landed and completed an activity-day. Add it.
 *
 * This is the instant half, and it is deliberately arithmetic rather than a
 * rebuild: one row read, one row written, no history. `days` is what the module
 * says now counts minus what counted before the press, so pressing a fourth
 * glass of an eight-glass day adds nothing and the eighth adds one.
 *
 * NOT atomic with the event that caused it, because this codebase has no
 * transactions available (the Neon HTTP driver refuses them). The event is the
 * truth and this is a cache, so the failure lands the right way round: a crash
 * between them leaves the counter one behind, the next close rebuilds it, and
 * `verify` reports it meanwhile. The same trade `confirmEvidence` already takes.
 */
export async function bumpStreak(
  userId: string,
  typeKey: string,
  days: string[],
): Promise<void> {
  if (days.length === 0) return;

  const stored = await readStreak(userId, typeKey);
  // Never counted before, so there is nothing to add to. Building it from
  // events is both correct and no slower than the read it replaces.
  if (!stored) {
    await rebuildStreak(userId, typeKey);
    return;
  }

  const activity = await getUserActivity(userId, typeKey);
  if (!activity) return;
  const unit = periodUnit(activity.schedule.schedule);

  const latest = days.reduce((a, b) => (a > b ? a : b));
  const current = stored.current + days.length;
  const week = unit === "week" ? mondayOf(latest) : null;

  await writeStreak(
    userId,
    typeKey,
    {
      current,
      best: Math.max(stored.best, current),
      graceSpent: stored.graceSpent,
      closedThrough: stored.closedThrough,
      weekStart: week,
      // A new week starts its own count; the same week continues.
      weekSessions:
        week === null ? 0 : (week === stored.weekStart ? stored.weekSessions : 0) + days.length,
    },
    latest,
  );
}

/**
 * Close whatever activity-days have ended since this type was last accounted
 * for. Called once a request by `closeOutstanding`, after the scoring pass has
 * written the periods this reads.
 *
 * It rebuilds rather than stepping forward day by day, and that is a
 * considered choice. A weekly streak is judged at week end against days spread
 * through the week, so stepping forward from a mid-week boundary would have to
 * carry the week's partial state and the grace it might spend, which is the
 * same walk `streakOver` already does correctly in one place. Rebuilding reads
 * two tables for one type and runs at most once per activity-day per type,
 * because `closedThrough` says when there is nothing to do. Duplicating the
 * walk to save that would be trading a correct number for a cheaper one.
 */
export async function closeStreak(userId: string, typeKey: string): Promise<void> {
  const activity = await getUserActivity(userId, typeKey);
  if (!activity) return;
  const [stored, scoredThrough] = await Promise.all([
    readStreak(userId, typeKey),
    scoredThroughFor(userId).then((m) => m.get(typeKey) ?? null),
  ]);
  if (!needsClosing(stored, scoredThrough)) return;
  await rebuildStreak(userId, typeKey);
}

/**
 * Has anything closed since this type was last accounted for?
 *
 * `closedThrough` is what makes the close idempotent: nothing new means nothing
 * to do, and the counter keeps whatever the press added.
 */
function needsClosing(stored: StoredStreak | null, scoredThrough: string | null): boolean {
  if (!stored?.closedThrough) return true;
  if (scoredThrough === null) return false;
  return scoredThrough > stored.closedThrough;
}

/**
 * The last day each type has been scored through, in one query for the user.
 *
 * Asking per type meant one round trip each to learn something a single GROUP
 * BY answers, and Home asks for six.
 */
async function scoredThroughFor(userId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({
      typeKey: activityScores.typeKey,
      periodEnd: sql<string>`max(${activityScores.periodEnd})`,
    })
    .from(activityScores)
    .where(eq(activityScores.userId, userId))
    .groupBy(activityScores.typeKey);
  return new Map(
    rows
      .filter((r) => r.periodEnd)
      .map((r) => [r.typeKey, addDays(String(r.periodEnd).slice(0, 10), -1)]),
  );
}

/**
 * Every stored counter for a user, in one query.
 *
 * Home draws a row per activity and each one wants a streak. Read once.
 */
export async function allStreaks(userId: string): Promise<Map<string, StoredStreak>> {
  const rows = await db
    .select()
    .from(activityStreaks)
    .where(eq(activityStreaks.userId, userId));
  return new Map(
    rows.map((row) => [
      row.typeKey,
      {
        current: row.current,
        best: row.best,
        graceSpent: row.graceSpent ?? {},
        closedThrough: row.closedThrough,
        weekStart: row.weekStart,
        weekSessions: row.weekSessions,
      },
    ]),
  );
}

/**
 * Close every type this user tracks, reading what it needs once rather than
 * once per type. The nightly job's half of the repair, and the read path's.
 */
export async function closeStreaks(userId: string): Promise<void> {
  const [activities, stored, scoredThrough] = await Promise.all([
    listUserActivities(userId),
    allStreaks(userId),
    scoredThroughFor(userId),
  ]);
  // Every type the user has ever tracked, not only the ones switched on.
  //
  // Stopping an activity does not delete what it was: the periods it was scored
  // for are still there, so a counter for them has to be too. Skipping the
  // disabled ones left a type with scores and no row, and `verify` reported
  // that as drift, correctly. What the number stops doing is moving.
  for (const a of activities) {
    if (!needsClosing(stored.get(a.typeKey) ?? null, scoredThrough.get(a.typeKey) ?? null)) {
      continue;
    }
    await rebuildStreak(userId, a.typeKey);
  }
}

/** What `verify` diffs the stored counter against. Writes nothing. */
export async function recomputeStreak(
  userId: string,
  typeKey: string,
): Promise<StreakState | null> {
  const rebuilt = await rebuildStreak(userId, typeKey, { write: false });
  if (!rebuilt) return null;
  return { current: rebuilt.current, best: rebuilt.best, graceSpent: rebuilt.graceSpent };
}
