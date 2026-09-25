// How established an activity is (1.49, C1).
//
// The number that replaces the streak on every surface for a type whose
// `measure` is "consistency". A streak counts consecutive compliance and
// breaks; this counts repetition and does not.
//
// WHAT IT IS, in one sentence, because a number people stare at every day has
// to be explainable in one: how often you have done it lately, times how far
// through 66 repetitions you are.
//
//     percent = rate × maturity
//
//     rate      passed / scheduled, over the last 30 scheduled periods
//     maturity  min(1, times you have ever passed / 66)
//
// SIXTY-SIX is Lally's median for a new behaviour to become automatic, range
// 18 to 254. It is a median and not a law, which is why the app says "to
// automatic" rather than "done".
//
// A MISS DOES NOT RESET IT (C2), and that is arithmetic rather than a rule laid
// on top. There is no branch anywhere in this file that asks what a miss does:
// a missed period simply is not counted, so it adds nothing and takes nothing.
// The number falls when the RATE falls, which takes several misses, and it
// falls gradually because old periods leave the window one at a time.
//
// WHAT IS DELIBERATELY NOT IN THE NUMBER: when you do it. Cue consistency
// matters to habit formation and it is the reason C6 exists, but folding it in
// would make the percentage unexplainable and easy to be quietly wrong about.
// It comes back as `usual`, a fact the screen states beside the number:
// "Usually 6:40 to 7:10 AM". One number, one sentence, neither pretending to
// be the other.
//
// It reads nothing but what it is handed. No database, no clock, no config.

/** Lally's median for a new behaviour to become automatic. */
export const AUTOMATIC_REPS = 66;

/** How many scheduled periods the rate is measured over. */
export const WINDOW_PERIODS = 30;

/**
 * How many timed presses are needed before "usually" means anything.
 *
 * Four presses can look tight by accident. This is the smallest number where
 * the spread is worth stating, and below it the screen says nothing rather
 * than something it cannot support.
 */
export const MIN_FOR_USUAL = 5;

export interface ConsistencyPeriod {
  /** Did this scheduled period pass? */
  passed: boolean;
  /**
   * Minutes past midnight of the press that decided it, in the member's own
   * zone, or null when there is no usable one.
   *
   * NULL for a late log (C10). A press at 11 PM for a lunch records when
   * somebody remembered rather than when they acted, which is the exact fault
   * the activities review found in Cold shower, and feeding it to `usual`
   * would make the app describe a cue nobody has.
   */
  minuteOfDay: number | null;
}

export interface ConsistencyInput {
  /** The last `WINDOW_PERIODS` SCHEDULED periods, oldest first. */
  window: ConsistencyPeriod[];
  /** How many periods this activity has ever passed. */
  lifetimePassed: number;
}

export interface Consistency {
  /** 0 to 100. What the row draws. */
  percent: number;
  /** Passed over scheduled in the window, 0 to 1. */
  rate: number;
  /** Passed in the window. */
  reps: number;
  /** Scheduled in the window. */
  scheduled: number;
  /**
   * Repetitions still wanted before 66, or NULL once it is there.
   *
   * Null rather than zero, and reading `sim:consistency` is what found it: a
   * row read "established 77%, 0 to automatic", which is a countdown that
   * finished and kept being printed. Null means the screen draws nothing,
   * because there is nothing left to say.
   *
   * REPETITIONS, not days, and the name says so because the two differ. Gym's
   * period is a week, so 26 of these is 26 weeks, and a screen that called
   * them days would be repeating the v3.4 defect where a gym streak was
   * counted in days. The caller knows the period; this does not.
   */
  repsToAutomatic: number | null;
  /**
   * The window somebody usually does it in, when enough presses were timed.
   *
   * Minutes past midnight, a median plus or minus the median deviation. Null
   * when fewer than `MIN_FOR_USUAL` presses carried a time.
   */
  usual: { fromMinute: number; toMinute: number } | null;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Null when nothing was scheduled, NEVER zero.
 *
 * Nought of nought is not nought per cent, it is no answer, and the screen has
 * to say a dash rather than a number about no days. Monk mode carries the same
 * rule for the same reason (1.16).
 */
export function consistency(input: ConsistencyInput): Consistency | null {
  const scheduled = input.window.length;
  if (scheduled === 0) return null;

  const passed = input.window.filter((p) => p.passed);
  const reps = passed.length;
  const rate = reps / scheduled;

  // Lifetime, not the window. Somebody who did this for a year, stopped, and
  // came back does not start again at zero maturity: the thing was once
  // automatic and rebuilds faster, and what fell is their RATE, which is what
  // the number should follow.
  const maturity = Math.min(1, input.lifetimePassed / AUTOMATIC_REPS);

  const times = passed
    .map((p) => p.minuteOfDay)
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b);

  let usual: Consistency["usual"] = null;
  if (times.length >= MIN_FOR_USUAL) {
    const mid = median(times);
    // Median absolute deviation, not standard deviation: one 3 AM press on a
    // bad night should not widen a window that is otherwise half an hour.
    const spread = median([...times.map((t) => Math.abs(t - mid))].sort((a, b) => a - b));
    usual = {
      fromMinute: Math.max(0, Math.round(mid - spread)),
      toMinute: Math.min(24 * 60 - 1, Math.round(mid + spread)),
    };
  }

  return {
    percent: Math.round(rate * maturity * 100),
    rate,
    reps,
    scheduled,
    repsToAutomatic:
      input.lifetimePassed >= AUTOMATIC_REPS
        ? null
        : AUTOMATIC_REPS - input.lifetimePassed,
    usual,
  };
}
