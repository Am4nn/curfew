import { weekdayOf } from "./period";
import { isScheduledDay, periodUnit, type Schedule } from "./schedule";

// Streaks. One rule, three cases (decision 2, ACTIVITIES.md).
//
// A streak is a count of DAYS you did the activity, never a count of periods.
// That is what makes the number mean the same thing whether an activity is
// judged daily or weekly, and it is why a six-session week adds six even when
// the minimum is three.
//
// THE NUMBER ONLY EVER ADDS ONE OR GOES TO ZERO. Grace makes it do neither: it
// holds where it is. There is no third movement, and nothing rolls it back to
// an earlier value. A number the user watched climb must not fall while the app
// tells them grace protected it.
//
// GRACE IS NOT DECIDED HERE any more (item 19). It used to be: a missed day
// spent an allowance automatically, counted in this state, capped per activity
// per month. Nobody chose it and nobody saw it happen. It is one pool for the
// account now, spent by hand after a streak has already ended, so what reaches
// this walk is a day somebody deliberately forgave, marked `graced`. The event
// is the record and this reads it, which is invariant 1 rather than a hole in
// invariant 2: `grace.spent` is an explicit press, it moves a streak and
// nothing else, and no fine or reputation row has ever read this file.
//
// Grace protects the streak only (decision 5). The fine still applies and
// reputation still dips; none of that lives here.
//
// This walks days and is the REBUILD, not the read path. The stored counter in
// activity_streaks is what a screen reads; this is what fills it and what
// `bun run verify` diffs it against.

/** One activity-day, already judged. `done` means the user did it that day. */
export interface StreakDay {
  date: string; // "yyyy-MM-dd"
  done: boolean;
  /**
   * Declared away. The run ends here and grace cannot hold it.
   *
   * This is the only thing a pause costs, and it is what lets there be no limit
   * on how often one is taken: a streak is consecutive days and a pause is a
   * gap, so pausing repeatedly is visibly self-defeating. The break happens
   * when the day CLOSES, like any missed day, because a paused day only reaches
   * this walk once its period has been scored (decision 134).
   */
  paused?: boolean;
  /**
   * Somebody spent grace on this period, after it had already failed.
   *
   * For a weekly activity it is set on any day of the week the grace covers,
   * because what failed is the week rather than a day in it.
   */
  graced?: boolean;
}

export interface StreakState {
  /** Days completed in the run that is still alive. */
  current: number;
  /** The longest run ever reached. Never taken back. */
  best: number;
}

interface StreakStep {
  /** The day, or for a weekly activity the Monday of the week judged. */
  at: string;
  current: number;
  graceUsed: boolean;
  /**
   * How much grace this period would cost to forgive, when it failed.
   *
   * One for a missed day. For a week, the number of days it came SHORT: a
   * three-a-week that got one session is two days short and costs two. Absent
   * on a period that did not fail.
   */
  short?: number;
}

export interface StreakResult extends StreakState {
  /** The running value after each day or week, in order. For charts and tests. */
  steps: StreakStep[];
}

export const EMPTY: StreakState = { current: 0, best: 0 };

/**
 * Walk a chronological run of activity-days and return the streak.
 *
 * `days` must be every day in range, not only the ones the user did, because a
 * missed scheduled day is exactly what breaks a run. Pass `from` to continue an
 * earlier result rather than recomputing from the join date.
 *
 * `asOf` is the last activity-day that has CLOSED. It only matters to weekly
 * activities, where a week is judged at week end: without it a week two days
 * old looks like a week that missed its minimum, and the streak would collapse
 * every Tuesday. Defaults to the last day supplied, which is what the nightly
 * job passes anyway.
 */
export function streakOver(
  days: StreakDay[],
  schedule: Schedule,
  from: StreakState = EMPTY,
  asOf?: string,
): StreakResult {
  const state: StreakState = { current: from.current, best: from.best };
  const steps: StreakStep[] = [];

  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (periodUnit(schedule) === "day") {
    for (const day of sorted) {
      // Unscheduled days are skipped, not broken. Office on Mon to Fri is not
      // ended by a Saturday, and a Saturday check-in adds nothing either.
      if (!isScheduledDay(schedule, weekdayOf(day.date))) continue;

      // Declared away. Not a miss to be forgiven, a gap in a run of
      // consecutive days, so grace is never even consulted.
      if (day.paused) {
        state.current = 0;
        steps.push({ at: day.date, current: 0, graceUsed: false });
        continue;
      }

      if (day.done) {
        state.current += 1;
        if (state.current > state.best) state.best = state.current;
        steps.push({ at: day.date, current: state.current, graceUsed: false });
        continue;
      }

      // A missed day. Grace holds the run where it is: a missed day is not a
      // completed day, so it does not add, but it does not reset either.
      if (!day.graced) state.current = 0;
      steps.push({
        at: day.date,
        current: state.current,
        graceUsed: day.graced === true,
        short: 1,
      });
    }
    return { ...state, steps };
  }

  // A minimum a week. Days add as they happen (decision 77), and the week is
  // judged at week end. A week that misses its minimum takes those days back:
  // the run resets, or holds where it is when grace covers it.
  const weeks = new Map<string, StreakDay[]>();
  for (const day of sorted) {
    const monday = mondayOf(day.date);
    const bucket = weeks.get(monday);
    if (bucket) bucket.push(day);
    else weeks.set(monday, [day]);
  }

  const minimum = schedule.kind === "minimum" ? schedule.perWeek : 0;
  const closedThrough = asOf ?? sorted.at(-1)?.date ?? "";

  for (const [monday, week] of weeks) {
    // A week entirely inside a pause. Nothing was scheduled, so nothing was
    // missed and no grace is spent, but the run of consecutive days is broken
    // all the same.
    if (week.length > 0 && week.every((d) => d.paused)) {
      if (sundayOf(monday) > closedThrough) continue;
      state.current = 0;
      steps.push({ at: monday, current: 0, graceUsed: false });
      continue;
    }

    let sessions = 0;

    for (const day of week) {
      if (!day.done) continue;
      sessions += 1;
      state.current += 1;
      if (state.current > state.best) state.best = state.current;
      steps.push({ at: day.date, current: state.current, graceUsed: false });
    }

    if (sessions >= minimum) continue;

    // Still in flight. Its days have counted up, and it is not judged until it
    // ends, so a good week shows progress and a bad one has time to recover.
    if (sundayOf(monday) > closedThrough) continue;

    // The week failed. Without grace the run ends. With it the run HOLDS where
    // it is, keeping the days this week did add.
    //
    // It used to roll back to the value the week opened on, taking those days
    // away again. That makes the number fall while the app says grace protected
    // it, which reads as a bug whatever the rule says. A streak only ever adds
    // one or goes to zero; grace is what makes it do neither.
    const graceUsed = week.some((d) => d.graced === true);
    if (!graceUsed) state.current = 0;
    steps.push({
      at: monday,
      current: state.current,
      graceUsed,
      // What the week came SHORT, not one. A three-a-week that managed one
      // missed two days of the thing and costs two to forgive.
      short: minimum - sessions,
    });
  }

  return { ...state, steps };
}

/**
 * What it would take to bring the run that just ended back.
 *
 * Null when nothing is broken, which is every activity on an ordinary day.
 * The offer exists from the moment a streak ends until the next check-in for
 * that activity, and this says so by construction: a done day after the break
 * puts `current` above zero and there is no tail to forgive.
 *
 * Worked out by replaying the same walk with those periods marked graced,
 * rather than by arithmetic on the side. The number it promises is then the
 * number the rebuild will produce, and it cannot drift from it.
 */
export interface RestoreOffer {
  /** The last period that failed, which is where the offer is dated. */
  brokeOn: string;
  /** Grace this costs: one a missed day. */
  cost: number;
  /** What the streak comes back to. */
  restoresTo: number;
  /** The periods the grace covers, for the event that records it. */
  covering: string[];
}

export function restoreOffer(
  days: StreakDay[],
  schedule: Schedule,
  asOf?: string,
): RestoreOffer | null {
  const walk = streakOver(days, schedule, EMPTY, asOf);
  if (walk.current > 0) return null;

  // The tail: every judged period after the last one the run was alive on.
  // A paused day is in here and is deliberately not forgivable, so an offer
  // covering one is no offer at all.
  let lastAlive = -1;
  for (let i = walk.steps.length - 1; i >= 0; i -= 1) {
    if (walk.steps[i].current > 0) {
      lastAlive = i;
      break;
    }
  }
  if (lastAlive === -1) return null; // never had a run to lose

  const tail = walk.steps.slice(lastAlive + 1);
  if (tail.length === 0 || tail.some((s) => s.short === undefined)) return null;

  const covering = tail.map((s) => s.at);
  const cost = tail.reduce((n, s) => n + (s.short ?? 0), 0);
  if (cost === 0) return null;

  const forgiven = new Set(coveredDays(days, schedule, covering));
  const after = streakOver(
    days.map((d) => (forgiven.has(d.date) ? { ...d, graced: true } : d)),
    schedule,
    EMPTY,
    asOf,
  );

  return { brokeOn: covering.at(-1)!, cost, restoresTo: after.current, covering };
}

/**
 * The days a set of covered PERIODS touches.
 *
 * A daily period is its own day. A weekly one is named by its Monday and the
 * grace mark has to reach a day the walk will actually look at, which is any
 * day of that week.
 */
export function coveredDays(
  days: StreakDay[],
  schedule: Schedule,
  periods: string[],
): string[] {
  if (periodUnit(schedule) === "day") return periods;
  const wanted = new Set(periods);
  return days.filter((d) => wanted.has(mondayOf(d.date))).map((d) => d.date);
}

// Local to this module: the streak walks days, and only weekly activities need
// to group them. periodStart() is for resolving an instant, which is a
// different question.
function sundayOf(monday: string): string {
  const [y, m, d] = monday.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 6)).toISOString().slice(0, 10);
}

function mondayOf(date: string): string {
  const weekday = weekdayOf(date);
  const [y, m, d] = date.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d - (weekday - 1));
  return new Date(utc).toISOString().slice(0, 10);
}
