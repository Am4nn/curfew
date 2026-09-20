import { DateTime } from "luxon";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityScores, activityStreaks, events } from "@/db/schema";
import {
  streakOver,
  restoreOffer,
  coveredDays,
  periodUnit,
  periodStart,
  daysDoneIn,
  getActivityType,
  EMPTY_STREAK,
  STREAK_LOGIC_VERSION,
  type StreakDay,
  type StreakState,
  type RestoreOffer,
  type Checkin,
  type Schedule,
} from "@/domain";
import { getUserActivity, listUserActivities } from "./activities";
import { timezoneHistory, type ZoneHistory } from "./config";
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
  /** The run is over on the arithmetic but still recoverable. See StreakState. */
  grey: boolean;
  closedThrough: string | null;
  weekStart: string | null;
  weekSessions: number;
  /** Which rules wrote this. A row from older ones is rebuilt, not trusted. */
  logicVersion: number;
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

/**
 * What `streakOver` should treat as closed, from what `activityDays` found.
 *
 * Null there means NOTHING has closed, and it has to survive the call. Passing
 * `undefined` lets the parameter default to the last day supplied, which for a
 * member whose first period is still running is TODAY, so the week in flight
 * gets judged as if it had ended.
 *
 * That is invisible six days a week and wrong on the seventh. A first gym
 * session on a Sunday is one session against a minimum of three, and the walk
 * read the week as closed and short, so the number went to 0 the moment it was
 * earned. `check:streak` exists for exactly this and had never run on a Sunday.
 *
 * The empty string is a day before every real day, so every week is still in
 * flight, which is what "nothing has closed" means.
 */
const asOf = (closedThrough: string | null): string => closedThrough ?? "";

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
    grey: row.grey,
    closedThrough: row.closedThrough,
    weekStart: row.weekStart,
    weekSessions: row.weekSessions,
    logicVersion: row.logicVersion,
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
  zones: ZoneHistory,
  inFlight: { period: string; config: unknown; schedule: Schedule } | null,
): Promise<{ days: StreakDay[]; closedThrough: string | null }> {
  const scored = await db
    .select({
      periodStart: activityScores.periodStart,
      periodEnd: activityScores.periodEnd,
      passed: activityScores.passed,
      paused: activityScores.paused,
    })
    .from(activityScores)
    .where(and(eq(activityScores.userId, userId), eq(activityScores.typeKey, typeKey)))
    .orderBy(activityScores.periodStart);

  // Whatever the period in flight has ALREADY earned.
  //
  // The press counts a day the moment it is done, so a rebuild that only looks
  // at closed periods would report a smaller number than the counter holds and
  // `verify` would call the counter wrong every evening. It found exactly that.
  //
  // Only days that are DONE are added, never a day that is merely not done yet.
  // A day still in progress has not been missed, and marking it false would end
  // a run at breakfast.
  //
  // Computed BEFORE the empty case below, which is what it was not. A member
  // whose first period has not closed has no scored rows at all, so the early
  // return threw these away and answered 0. Their first ever session showed no
  // streak, and for gym, whose period is a week, it showed none for a week.
  const live = inFlight
    ? await daysDoneInFlight(userId, typeKey, zones.on(inFlight.period), inFlight)
    : [];

  // Nothing has closed, so there is no history to walk and the period in
  // flight is the whole story. `closedThrough` stays null: nothing has been
  // judged, which is what stops `streakOver` ending a week that is still
  // running.
  if (scored.length === 0) {
    return {
      days: live.map((date) => ({ date, done: true, paused: false })),
      closedThrough: null,
    };
  }

  // The last day any closed period covers. A week scored on its Monday has
  // been judged through the Sunday after it.
  const closedThrough = scored
    .map((s) => addDays(s.periodEnd, -1))
    .reduce((a, b) => (a > b ? a : b));

  if (unit === "day") {
    const days = scored.map((s) => ({
      date: s.periodStart,
      done: s.passed,
      paused: s.paused,
    }));
    // A day in flight has not closed, so it cannot have been paused yet: the
  // break lands when the period is scored, like any missed day.
  for (const date of live) if (date > closedThrough) days.push({ date, done: true, paused: false });
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
    // The zone that week was lived in, not the one the member is in now: a
    // press is attributed to a calendar day, and which day that is depends on
    // the clock it was made under.
    const counted = daysDoneIn(typeKey, {
      periodStart: s.periodStart,
      timezone: zones.on(s.periodStart),
      config: activity?.config,
      // An untracked type still has history to count, and the schedule it was
      // judged under is the one it declares.
      schedule: activity?.schedule.schedule ?? getActivityType(typeKey).defaults.schedule,
      checkins: byPeriod.get(s.periodStart) ?? [],
    });
    for (const day of counted) done.add(day);
  }

  // A weekly period is paused only when its whole week is, so every day of a
  // paused week is one, which is what the weekly branch of streakOver looks for.
  const pausedDays = new Set<string>();
  for (const sc of scored) {
    if (!sc.paused) continue;
    for (const day of dayList(sc.periodStart, addDays(sc.periodEnd, -1))) {
      pausedDays.add(day);
    }
  }

  const first = scored[0].periodStart;
  const last = addDays(scored[scored.length - 1].periodEnd, -1);
  const days = dayList(first, last).map((date) => ({
    date,
    done: done.has(date),
    paused: pausedDays.has(date),
  }));
  // The week in flight adds its days as they happen (decision 77). It is not
  // judged: `closedThrough` is what streakOver measures a week's end against,
  // so this week stays in flight until its Sunday has closed.
  // A day in flight has not closed, so it cannot have been paused yet: the
  // break lands when the period is scored, like any missed day.
  for (const date of live) if (date > closedThrough) days.push({ date, done: true, paused: false });
  return { days, closedThrough };
}

/** The days the module counts in a period that has not closed yet. */
async function daysDoneInFlight(
  userId: string,
  typeKey: string,
  timezone: string,
  inFlight: { period: string; config: unknown; schedule: Schedule },
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
    schedule: inFlight.schedule,
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
/**
 * Which periods of one activity somebody has spent grace on.
 *
 * Read from `grace.spent` events over the whole history: grace spent in March
 * still holds a March day when the streak is rebuilt in September. It lives
 * here rather than beside the rest of grace in `restore.ts` because the REBUILD
 * needs it and `restore.ts` needs the rebuild, and one of the two had to not
 * import the other.
 */
async function gracedPeriods(
  userId: string,
  typeKey: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ payload: events.payload })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.type, "grace.spent"),
        sql`${events.payload}->>'type_key' = ${typeKey}`,
      ),
    );

  const out = new Set<string>();
  for (const r of rows) {
    const covering = ((r.payload ?? {}) as Record<string, unknown>).covering;
    if (Array.isArray(covering)) for (const p of covering) out.add(String(p));
  }
  return out;
}

/** The days those periods touch, marked so the walk holds the run there. */
function markGraced(
  days: StreakDay[],
  schedule: Schedule,
  periods: Set<string>,
): StreakDay[] {
  if (periods.size === 0) return days;
  const forgiven = new Set(coveredDays(days, schedule, [...periods]));
  return days.map((d) => (forgiven.has(d.date) ? { ...d, graced: true } : d));
}

/** The day list one activity's walk is built from, with grace already applied. */
async function walkFor(
  userId: string,
  typeKey: string,
): Promise<{
  activity: NonNullable<Awaited<ReturnType<typeof getUserActivity>>>;
  days: StreakDay[];
  closedThrough: string | null;
  /** The member's local date now. What lets a week go grey before it ends. */
  today: string;
  timezone: string;
  instant: Date;
  unit: "day" | "week";
} | null> {
  const activity = await getUserActivity(userId, typeKey);
  if (!activity) return null;

  const instant = await now();
  const zones = await timezoneHistory(userId);
  const timezone = zones.at(instant);
  const unit = periodUnit(activity.schedule.schedule);
  const inFlight = {
    period: periodStart(instant, timezone, {
      unit,
      boundary: activity.schedule.dayBoundary,
    }),
    config: activity.config,
    schedule: activity.schedule.schedule,
  };
  const { days, closedThrough } = await activityDays(userId, typeKey, unit, zones, inFlight);

  return {
    activity,
    // Grace is applied here rather than decided in the walk (item 19). The
    // periods somebody forgave are `grace.spent` events, so what reaches
    // `streakOver` is a day already marked, and the walk stays a walk.
    days: markGraced(
      days,
      activity.schedule.schedule,
      await gracedPeriods(userId, typeKey),
    ),
    closedThrough,
    timezone,
    instant,
    today: iso(DateTime.fromJSDate(instant, { zone: timezone })),
    unit,
  };
}

/**
 * What it would cost to bring this activity's ended streak back, or null.
 *
 * The same day list the rebuild uses, so the number on the button is the number
 * the rebuild will produce. Grace already spent is already applied, which is
 * what stops an offer being made twice for the same break.
 */
export async function offerFor(
  userId: string,
  typeKey: string,
): Promise<RestoreOffer | null> {
  const walk = await walkFor(userId, typeKey);
  if (!walk) return null;
  return restoreOffer(
    walk.days,
    walk.activity.schedule.schedule,
    asOf(walk.closedThrough),
    walk.today,
  );
}

export async function rebuildStreak(
  userId: string,
  typeKey: string,
  opts: { write?: boolean } = {},
): Promise<StoredStreak | null> {
  const walk = await walkFor(userId, typeKey);
  if (!walk) return null;
  const { activity, days, closedThrough, today, unit } = walk;

  const result = streakOver(
    days,
    activity.schedule.schedule,
    EMPTY_STREAK,
    asOf(closedThrough),
    today,
  );

  // The week in flight, so a press can add to it without re-reading history.
  const weekStart = unit === "week" ? mondayOf(today) : null;
  const weekSessions =
    weekStart === null
      ? 0
      : days.filter((d) => d.done && d.date >= weekStart).length;

  const stored: StoredStreak = {
    current: result.current,
    best: result.best,
    grey: result.grey,
    closedThrough,
    weekStart,
    weekSessions,
    logicVersion: STREAK_LOGIC_VERSION,
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
      grey: s.grey,
      lastDay,
      weekStart: s.weekStart,
      weekSessions: s.weekSessions,
      closedThrough: s.closedThrough,
      logicVersion: s.logicVersion,
    })
    .onConflictDoUpdate({
      target: [activityStreaks.userId, activityStreaks.typeKey],
      set: {
        current: sql`excluded.current`,
        best: sql`excluded.best`,
        grey: sql`excluded.grey`,
        lastDay: sql`excluded.last_day`,
        weekStart: sql`excluded.week_start`,
        weekSessions: sql`excluded.week_sessions`,
        closedThrough: sql`excluded.closed_through`,
        logicVersion: sql`excluded.logic_version`,
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
  const week = unit === "week" ? mondayOf(latest) : null;

  // A press against a GREY run, and which week it lands in decides everything.
  //
  // In the SAME week the run went grey, it adds: two sessions over the weekend
  // of a dead three-a-week are two days of the thing, and they bring the price
  // of forgiving that week down from three to one.
  //
  // In a LATER week, turning up is the answer. The offer expires, the old run
  // is over, and this is day one of a new one. It is the only place a weekly
  // streak returns to zero, and `streakOver` does the same thing on rebuild.
  const restarting = stored.grey && week !== null && week !== stored.weekStart;
  const current = (restarting ? 0 : stored.current) + days.length;

  await writeStreak(
    userId,
    typeKey,
    {
      current,
      best: Math.max(stored.best, current),
      grey: restarting ? false : stored.grey,
      closedThrough: stored.closedThrough,
      weekStart: week,
      // A new week starts its own count; the same week continues.
      weekSessions:
        week === null ? 0 : (week === stored.weekStart ? stored.weekSessions : 0) + days.length,
      // The CURRENT version, not the one the row arrived with. This function is
      // part of the logic that version names: it mirrors the grey and restart
      // rules above by hand, because a press cannot afford a replay. Carrying
      // the old version forward would mark a row this code just wrote as
      // something this code does not recognise, and rebuild it on every close.
      logicVersion: STREAK_LOGIC_VERSION,
    },
    latest,
  );
}

/**
 * Has anything closed since this type was last accounted for?
 *
 * `closedThrough` is what makes the close idempotent: nothing new means nothing
 * to do, and the counter keeps whatever the press added.
 */
function needsClosing(
  stored: StoredStreak | null,
  scoredThrough: string | null,
  unit: "day" | "week",
): boolean {
  // THE RULES MOVED. Everything below this asks whether anything NEW has
  // happened, which is the wrong question after a rule change: nothing has
  // happened and the stored answer is still wrong. Reputation's resume refuses
  // a row from an older `LOGIC_VERSION` for the same reason, and this is the
  // streak half of it (migration 0032).
  //
  // A row written before the column existed reads 0 and rebuilds once, which is
  // the point: those rows were written by logic nothing can name.
  if (stored && stored.logicVersion !== STREAK_LOGIC_VERSION) return true;

  // A WEEKLY type always rebuilds. Its run can now go grey in the MIDDLE of a
  // week, the moment the minimum stops being reachable, and nothing has closed
  // when that happens: no period ended, no score was written, so the gate below
  // would skip the one rebuild that would notice. The alternative is to
  // re-derive reachability here from the stored week, which needs to know
  // whether TODAY is one of the sessions already counted, and the row does not
  // say. One extra rebuild for one activity is the cheaper thing to be wrong
  // about; a streak that reads healthy when the arithmetic says it is grey is
  // the thing this whole rule exists to stop.
  if (unit === "week") return true;
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
        grey: row.grey,
        closedThrough: row.closedThrough,
        weekStart: row.weekStart,
        weekSessions: row.weekSessions,
        logicVersion: row.logicVersion,
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
    const needed = needsClosing(
      stored.get(a.typeKey) ?? null,
      scoredThrough.get(a.typeKey) ?? null,
      periodUnit(a.schedule.schedule),
    );
    if (!needed) continue;
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
  return { current: rebuilt.current, best: rebuilt.best, grey: rebuilt.grey };
}
