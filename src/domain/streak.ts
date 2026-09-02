import { graceMonth, weekdayOf } from "./period";
import { isScheduledDay, periodUnit, type Schedule } from "./schedule";

// Streaks. One rule, three cases (decision 2, ACTIVITIES.md).
//
// A streak is a count of DAYS you did the activity, never a count of periods.
// That is what makes the number mean the same thing whether an activity is
// judged daily or weekly, and it is why a six-session week adds six even when
// the minimum is three.
//
// Grace protects the streak only (decision 5). The fine still applies and
// reputation still dips; none of that lives here.

/** One activity-day, already judged. `done` means the user did it that day. */
export interface StreakDay {
  date: string; // "yyyy-MM-dd"
  done: boolean;
}

export interface StreakState {
  /** Days completed in the run that is still alive. */
  current: number;
  /** The longest run ever reached. Never taken back. */
  best: number;
  /** Grace spent, keyed "yyyy-MM". Unused grace does not carry over. */
  graceSpent: Record<string, number>;
}

export interface StreakStep {
  /** The day, or for a weekly activity the Monday of the week judged. */
  at: string;
  current: number;
  graceUsed: boolean;
}

export interface StreakResult extends StreakState {
  /** The running value after each day or week, in order. For charts and tests. */
  steps: StreakStep[];
}

export const EMPTY: StreakState = { current: 0, best: 0, graceSpent: {} };

function spend(state: StreakState, month: string, allowance: number): boolean {
  const used = state.graceSpent[month] ?? 0;
  if (used >= allowance) return false;
  state.graceSpent[month] = used + 1;
  return true;
}

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
  gracePerMonth: number,
  from: StreakState = EMPTY,
  asOf?: string,
): StreakResult {
  const state: StreakState = {
    current: from.current,
    best: from.best,
    graceSpent: { ...from.graceSpent },
  };
  const steps: StreakStep[] = [];

  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (periodUnit(schedule) === "day") {
    for (const day of sorted) {
      // Unscheduled days are skipped, not broken. Office on Mon to Fri is not
      // ended by a Saturday, and a Saturday check-in adds nothing either.
      if (!isScheduledDay(schedule, weekdayOf(day.date))) continue;

      let graceUsed = false;
      if (day.done) {
        state.current += 1;
      } else if (spend(state, graceMonth(day.date), gracePerMonth)) {
        // Grace holds the run where it is. A missed day is not a completed day,
        // so it does not add, but it does not reset either.
        graceUsed = true;
      } else {
        state.current = 0;
      }
      if (state.current > state.best) state.best = state.current;
      steps.push({ at: day.date, current: state.current, graceUsed });
    }
    return { ...state, steps };
  }

  // A minimum a week. Days add as they happen (decision 77), and the week is
  // judged at week end. A week that misses its minimum takes those days back:
  // the run resets, or returns to the value the week opened on when grace
  // covers it.
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
    const opening = state.current;
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

    // The week failed. Everything it added comes back off.
    const graceUsed = spend(state, graceMonth(monday), gracePerMonth);
    state.current = graceUsed ? opening : 0;
    steps.push({ at: monday, current: state.current, graceUsed });
  }

  return { ...state, steps };
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

/** Grace left this month, for the "2 graces left this month" line in the UI. */
export function graceLeft(
  state: StreakState,
  month: string,
  gracePerMonth: number,
): number {
  return Math.max(0, gracePerMonth - (state.graceSpent[month] ?? 0));
}
