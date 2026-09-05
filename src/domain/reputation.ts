// Reputation: 0 to 1000, per user per group. See `.planning/v3/REPUTATION.md`.
//
// A running score, not a recomputed window: each day applies a delta on top of
// yesterday. Gains shrink as the score climbs, so 1000 is approached and never
// reached. Losses soften at the top too, so one miss dents a long record rather
// than collapsing it.
//
// Breadth sets a ceiling. Sharing one activity of five caps you well below the
// top by construction, which is what stops a perfect record on one easy habit
// outranking a good record on five hard ones.

export const MIN_SCORE = 0;
export const MAX_SCORE = 1000;

/**
 * Tunable. The target properties in REPUTATION.md are the spec, not these.
 *
 * Those targets cannot all be met at once, and the constants here are the
 * closest fit rather than an exact one. "350 in five weeks" and "600 in two
 * months" together ask the score to climb 150 points in five weeks and the next
 * 250 in three, which needs the rate to rise faster than "950 in seven months"
 * allows it to fall. See the note in reputation.test.ts.
 */
export const CONSTANTS = {
  /** Gain on a clean day, before headroom and warm-up. */
  gain: 20,
  /**
   * Damps early gains: a fresh member climbs slower than one with a record,
   * because they have not shown anything yet. Without it the first rank-up
   * arrives in under three weeks, half what the spec asks.
   */
  warmup: 150,
  /**
   * A missed day costs the clean days it would take to undo, from about two at
   * the start to a week at the top. Stating the loss in days is what makes the
   * two recovery targets in REPUTATION.md hit at once: expressed as a flat
   * points figure, a loss that stings at 900 is ruinous at 200.
   */
  missCostDaysLow: 2,
  missCostDaysHigh: 7,
  /**
   * Floors the headroom used for a loss, so a miss still costs something to
   * someone sitting exactly on their ceiling, where a gain would be zero.
   */
  headroomFloor: 0.03,
  /** Per day, while the score sits above a ceiling that dropped. */
  drift: 2,
  /** Per day, once nothing has been scheduled for a week. */
  idle: 3,
  /** Days before nothing-scheduled counts as idle. */
  idleAfterDays: 7,
  /** A newly added activity cannot move reputation for this long (decision 54). */
  settlingDays: 7,
} as const;

export const START_SCORE = 200;

/**
 * The version of the curve. BUMP IT whenever `applyDay` or `CONSTANTS` change.
 *
 * The stored score is carried forward rather than replayed, which is safe only
 * while the rules that produced it are the rules in force. Idempotent is not
 * the same as still correct: re-running a close gives the same answer, and
 * changing the maths does not. Every stored day records the version that made
 * it, and the incremental close refuses to build on a version it does not
 * recognise, replaying that user from the beginning instead.
 *
 * Forgetting to bump this does not fail loudly. It silently carries a number
 * computed under the old rules, and `bun run verify` is what says so.
 */
export const LOGIC_VERSION = 1;

/**
 * The score is a number with three decimals, not a float shown to three.
 *
 * `reputation_daily.score` is `numeric(7,3)`, so a stored day is rounded. While
 * the whole curve was replayed from the join date every time, that rounding was
 * only ever a display detail: the replay carried full precision from day to
 * day and rounded once, at the end.
 *
 * Carrying yesterday's STORED score forward makes the rounding an input.
 * Reading back 214.994 and continuing from it is not the same as continuing
 * from 214.9944, and over a week the two answers separate by a thousandth.
 * `bun run verify` found exactly that, which is the first thing it caught that
 * nothing else would have.
 *
 * So three decimals is the value, not the picture of it. Rounded here, every
 * day, the stored row IS the state and an opening balance is exact. This is why
 * a closing record has to be a faithful summary rather than a nearly faithful
 * one.
 */
const quantise = (n: number) => Math.round(n * 1000) / 1000;

const clamp = (n: number) =>
  quantise(Math.min(MAX_SCORE, Math.max(MIN_SCORE, n)));

/**
 * The highest score this breadth allows. b = 0 caps at 250, b = 1 at 1000.
 *
 * `b` is shared types over the group's accepted types. The global score uses
 * b = 1 (decision 53), because there is no group to be narrow within.
 */
export function ceilingFor(breadth: number): number {
  const b = Math.min(1, Math.max(0, breadth));
  return 250 + 750 * b;
}

/**
 * The score someone starts on when they join a group, from their global score
 * (decision 10). Clamped to 100..300, so a good record helps a little and a bad
 * one cannot be escaped by leaving and rejoining.
 */
export function joiningScore(global: number): number {
  // Quantised for the same reason applyDay is: a day on which nothing was
  // scheduled returns this number untouched, and it is then stored rounded.
  return quantise(Math.min(300, Math.max(100, 100 + (global / MAX_SCORE) * 200)));
}

export type DayReason = "clean" | "incomplete" | "drift" | "idle" | "neutral";

export interface DayInput {
  /** Yesterday's score. */
  score: number;
  /** The ceiling as it stands today. */
  ceiling: number;
  /**
   * Periods passed over periods scheduled and concluding today, counting only
   * activities that count for this score. Null when nothing was scheduled.
   */
  completion: number | null;
  /** Days since anything was last scheduled, including today. */
  idleDays: number;
}

export interface DayResult {
  score: number;
  delta: number;
  reason: DayReason;
}

/**
 * One day's movement.
 *
 * Order matters. A day above a dropped ceiling drifts whatever else happened,
 * because the ceiling is the promise breadth makes and the score has to come
 * back under it. Only then does the day itself count.
 */
export function applyDay(input: DayInput): DayResult {
  const { score, ceiling, completion, idleDays } = input;

  // Above a ceiling that dropped: come down, no cliff (decision 15).
  if (score > ceiling) {
    const next = clamp(Math.max(ceiling, score - CONSTANTS.drift));
    return { score: next, delta: next - score, reason: "drift" };
  }

  if (completion === null) {
    // Nothing scheduled. Idle only once a week has passed with nothing due,
    // or a weekly activity would decay on its six quiet days.
    if (idleDays >= CONSTANTS.idleAfterDays) {
      const next = clamp(score - CONSTANTS.idle);
      return { score: next, delta: next - score, reason: "idle" };
    }
    return { score, delta: 0, reason: "neutral" };
  }

  const headroom = Math.max(0, ceiling - score) / MAX_SCORE;
  const warm = (score + CONSTANTS.warmup) / (ceiling + CONSTANTS.warmup);

  if (completion >= 1) {
    const next = clamp(score + CONSTANTS.gain * headroom * warm);
    return { score: next, delta: next - score, reason: "clean" };
  }

  // What one clean day is worth here, and how many of them this miss costs.
  const dayWorth =
    CONSTANTS.gain * Math.max(headroom, CONSTANTS.headroomFloor) * warm;
  const costDays =
    CONSTANTS.missCostDaysLow +
    (CONSTANTS.missCostDaysHigh - CONSTANTS.missCostDaysLow) * (score / MAX_SCORE);

  const next = clamp(score - (1 - completion) * costDays * dayWorth);
  return { score: next, delta: next - score, reason: "incomplete" };
}

export interface ReplayDay {
  date: string;
  ceiling: number;
  completion: number | null;
  idleDays: number;
}

export interface ReplayRow extends DayResult {
  date: string;
  ceiling: number;
}

/**
 * Replay a run of days from a starting score.
 *
 * This is the whole of reputation: the stored table is one row a day of this,
 * and `bun run verify` recomputes a range by calling it again. Nothing about a
 * day depends on anything but yesterday's score and that day's facts.
 */
export function replay(from: number, days: ReplayDay[]): ReplayRow[] {
  let score = from;
  const out: ReplayRow[] = [];
  for (const day of days) {
    const result = applyDay({
      score,
      ceiling: day.ceiling,
      completion: day.completion,
      idleDays: day.idleDays,
    });
    score = result.score;
    out.push({ date: day.date, ceiling: day.ceiling, ...result });
  }
  return out;
}
