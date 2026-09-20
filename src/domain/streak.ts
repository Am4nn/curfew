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
  /** Days completed in the run. Grey or not, this is the number on screen. */
  current: number;
  /** The longest run ever reached. Never taken back. */
  best: number;
  /**
   * The run is over on the arithmetic but still recoverable. GREY.
   *
   * A streak only ever goes UP. It does not fall on the Sunday of a week that
   * came short, and it does not fall the moment a week becomes impossible. It
   * goes grey: the same number, marked, with something to decide about it.
   *
   * Grey starts the moment the week's minimum stops being reachable, which can
   * be mid-week. Sessions logged after that STILL ADD, and still count against
   * what the week came short, because a person who turns up on Saturday and
   * Sunday of a dead week has missed one day of three rather than three.
   *
   * It ends one of two ways. Grace forgives the week and the run carries on
   * from where it is. Or the next session in a LATER week starts a new run from
   * one, which is the only place a weekly streak returns to zero.
   */
  grey: boolean;
}

interface StreakStep {
  /** The day, or for a weekly activity the Monday of the week judged. */
  at: string;
  current: number;
  graceUsed: boolean;
  /**
   * This period ended the run, or would have without grace.
   *
   * It used to be inferred from `current` falling to zero, and grey took that
   * away: a weekly run that came short HOLDS its number, so a step can be a
   * failure and still carry a positive count. `restoreOffer` reads this to find
   * the tail of periods a grace spend would have to cover.
   */
  failed?: boolean;
  /**
   * The period is grey but has NOT ended, so it has no price yet.
   *
   * A week goes grey the moment its minimum is unreachable, and what it will
   * finally be short by is not known until Sunday: nothing logged by Saturday
   * is three short, and two sessions over the weekend makes it one. An offer
   * cannot name a number yet, so `restoreOffer` steps over these rather than
   * refusing on them, and the member can still forgive the weeks behind it.
   */
  open?: boolean;
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

export const EMPTY: StreakState = { current: 0, best: 0, grey: false };

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
 * every Tuesday. Defaults to the last day supplied, which is what the jobs pass
 * anyway.
 *
 * `today` is the member's current local date, and it is what lets a week go
 * GREY early, before it has ended. Omit it and a week is only ever judged at
 * its Sunday, which is what every caller did before and what the tests that do
 * not pass it still assert.
 */
export function streakOver(
  days: StreakDay[],
  schedule: Schedule,
  // Grey is optional coming IN and always present going OUT. A caller
  // continuing an earlier result passes it; one starting from a pair of numbers
  // does not have to invent it.
  from: { current: number; best: number; grey?: boolean } = EMPTY,
  asOf?: string,
  today?: string,
): StreakResult {
  const state: StreakState = {
    current: from.current,
    best: from.best,
    grey: from.grey ?? false,
  };
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
        // Not grey. A pause is a gap the member declared, not a day they
        // missed, so there is nothing to forgive and nothing to decide. It is
        // the one thing that still takes a daily run straight to zero.
        state.current = 0;
        state.grey = false;
        steps.push({ at: day.date, current: 0, graceUsed: false, failed: true });
        continue;
      }

      if (day.done) {
        // The first day after a grey run is day one of a new one. Turning up is
        // what answers the offer, and it is the only place a run returns to
        // zero. Same rule as a session in a week after a grey week.
        if (state.grey) {
          state.current = 0;
          state.grey = false;
        }
        state.current += 1;
        if (state.current > state.best) state.best = state.current;
        steps.push({ at: day.date, current: state.current, graceUsed: false });
        continue;
      }

      // A missed day. The run is over, and the number does NOT fall: it goes
      // GREY and holds, the same as a weekly week that came short. A forty day
      // run that vanishes to nothing is worse to look at than one that dims,
      // and the days happened either way.
      //
      // Grace holds it without the grey, because a forgiven day is not a break.
      //
      // And only a run that EXISTS can end. Grey on a zero is a dead flame
      // beside a nought on every activity somebody has never managed, which is
      // noise where there was previously nothing: there is no number being
      // held, so there is nothing for the grey to say.
      if (!day.graced) state.grey = state.current > 0;
      steps.push({
        at: day.date,
        current: state.current,
        graceUsed: day.graced === true,
        failed: true,
        short: 1,
      });
    }
    return { ...state, steps };
  }

  // A minimum a week. Days add as they happen (decision 77).
  //
  // A week that misses its minimum does NOT take those days back and does not
  // zero the run. It goes GREY: the number holds, marked, with a choice
  // attached. See StreakState.grey. Grey starts the moment the minimum becomes
  // unreachable, which is usually before the week has ended, and the only thing
  // that returns a weekly streak to zero is the next session in a later week.
  const weeks = new Map<string, StreakDay[]>();
  for (const day of sorted) {
    const monday = mondayOf(day.date);
    const bucket = weeks.get(monday);
    if (bucket) bucket.push(day);
    else weeks.set(monday, [day]);
  }

  // The week in progress, even when it is empty.
  //
  // A caller supplies the days it knows about, and for the week in flight that
  // is only the days already DONE. So a week in which nothing has happened
  // contributes no days, produces no bucket, and would never be looked at,
  // which is exactly the week grey exists for: nothing logged by Saturday is
  // the case where a three-a-week has already failed.
  if (today && !weeks.has(mondayOf(today))) weeks.set(mondayOf(today), []);

  const minimum = schedule.kind === "minimum" ? schedule.perWeek : 0;
  const closedThrough = asOf ?? sorted.at(-1)?.date ?? "";
  /** The Monday of the week the run went grey on, so a later one can end it. */
  let greySince: string | null = null;

  for (const [monday, week] of weeks) {
    // A week entirely inside a pause. Nothing was scheduled, so nothing was
    // missed and no grace is spent, but the run of consecutive days is broken
    // all the same.
    if (week.length > 0 && week.every((d) => d.paused)) {
      if (sundayOf(monday) > closedThrough) continue;
      // Not grey. A pause is a gap the member declared, not a week they came
      // short in, so there is nothing to forgive and nothing to decide.
      state.current = 0;
      state.grey = false;
      greySince = null;
      steps.push({ at: monday, current: 0, graceUsed: false, failed: true });
      continue;
    }

    // A session in a week AFTER the one that went grey. The offer has expired
    // by turning up: the old run is over, and this is the first day of a new
    // one. The only place a weekly streak goes to zero.
    if (state.grey && greySince !== null && monday > greySince) {
      if (week.some((d) => d.done)) {
        state.current = 0;
        state.grey = false;
        greySince = null;
      }
    }

    let sessions = 0;

    for (const day of week) {
      if (!day.done) continue;
      sessions += 1;
      // Sessions add whether or not the week is already grey. Somebody who goes
      // on the Saturday and Sunday of a dead week did two days of the thing,
      // and the week is short by one rather than by three.
      state.current += 1;
      if (state.current > state.best) state.best = state.current;
      steps.push({ at: day.date, current: state.current, graceUsed: false });
    }

    if (sessions >= minimum) {
      // The week was made. Anything grey before it has been overtaken.
      state.grey = false;
      greySince = null;
      continue;
    }

    const ended = sundayOf(monday) <= closedThrough;
    const reachable = !ended && !unreachable(week, monday, minimum, sessions, today);

    // Still in flight and still possible. Its days have counted up and it is
    // not judged yet, so a good week shows progress and a bad one has time.
    if (reachable) continue;

    // Grey, from here. Either the minimum can no longer be reached or the week
    // has ended short. Grace forgives it and the run carries on; otherwise the
    // number holds where it is, marked, until the next session in a later week.
    // Only a run that EXISTS can end: grey holds a number, and there is
    // nothing to hold at zero. Same reason as the daily branch above.
    const graceUsed = week.some((d) => d.graced === true);
    state.grey = !graceUsed && state.current > 0;
    greySince = state.grey ? monday : null;

    // Only a week that has ENDED carries a price. While it is still running the
    // shortfall is not final: nothing logged by Saturday is three short, and
    // two sessions over the remaining weekend makes it one. Quoting a number
    // before the week is out either shows the wrong one or freezes it and
    // charges somebody for still turning up. `restoreOffer` refuses a tail with
    // no price, which is what keeps the offer off the screen until Monday.
    steps.push({
      at: monday,
      current: state.current,
      graceUsed,
      failed: true,
      // What the week came SHORT, not one. A three-a-week that managed one
      // missed two days of the thing and costs two to forgive.
      ...(ended ? { short: minimum - sessions } : { open: true }),
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
  today?: string,
): RestoreOffer | null {
  const walk = streakOver(days, schedule, EMPTY, asOf, today);
  // Nothing to offer on a run that is still going. A weekly run that has gone
  // grey still HOLDS its number, so a positive count no longer means alive and
  // the flag is what says which it is. A daily miss still zeroes, so both
  // conditions are asked.
  if (walk.current > 0 && !walk.grey) return null;

  // The tail: every failed period after the last one that was not a failure.
  // A paused day is in here and is deliberately not forgivable, so an offer
  // covering one is no offer at all. A week still RUNNING that has gone grey is
  // in here too and carries no `short`, which is what keeps the offer off the
  // screen until the week ends and its price is final.
  //
  // This asked `current > 0` until grey arrived. A grey run holds its number,
  // so a failed step can have a positive count and the scan ran off the end.
  let lastAlive = -1;
  for (let i = walk.steps.length - 1; i >= 0; i -= 1) {
    if (!walk.steps[i].failed) {
      lastAlive = i;
      break;
    }
  }
  if (lastAlive === -1 && walk.steps.every((s) => s.failed)) return null;

  // Trailing periods that are grey but still running are dropped, not refused.
  // They have no price yet, and letting one block the offer would mean that
  // being in a bad week stops you forgiving the week before it, for up to seven
  // days. Each week gets its own decision when it ends.
  let tail = walk.steps.slice(lastAlive + 1);
  while (tail.length > 0 && tail[tail.length - 1].open) tail = tail.slice(0, -1);

  // What is left must all carry a price. A paused day never does, which is what
  // keeps a declared absence unforgivable.
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
    today,
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

/**
 * Can this week still reach its minimum?
 *
 * False, meaning it still can, whenever the answer is not certain: no `today`,
 * a week that is not the one `today` sits in, or a schedule with no minimum. A
 * run is only ever marked grey here by arithmetic that cannot come out the
 * other way.
 *
 * Counts the days from today to Sunday that are NOT already done, so a session
 * logged this morning is not counted twice, once as a session and again as a
 * day still available.
 */
function unreachable(
  week: StreakDay[],
  monday: string,
  minimum: number,
  sessions: number,
  today?: string,
): boolean {
  if (!today || minimum <= 0) return false;
  const sunday = sundayOf(monday);
  if (today < monday || today > sunday) return false;

  const done = new Set(week.filter((d) => d.done).map((d) => d.date));
  let left = 0;
  for (let d = today; d <= sunday; d = addDay(d)) if (!done.has(d)) left += 1;
  return sessions + left < minimum;
}

// Local to this module: the streak walks days, and only weekly activities need
// to group them. periodStart() is for resolving an instant, which is a
// different question.
function addDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

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
