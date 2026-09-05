// Ranks are bands on the reputation score. See `.planning/v3/RANKS.md`.
//
// IMMACULATE is a title inside UNBROKEN, not a sixth band: it carries the only
// glow in the app, which is what makes it mean anything.
//
// It is NOT a score threshold, and that is a deliberate correction. It used to
// be "950 or more", and the simulation showed that a steady 87.5% completion,
// one missed day in eight, settles at 969 and holds the glow. IMMACULATE means
// "the record has no meaningful gaps"; forty-five gaps a year is not that. The
// score saturates near the top, so it cannot measure perfection however the
// line is drawn.
//
// So perfection is measured as perfection: the top band, plus a run of days
// with nothing missed. A number that can be reasoned about, and one nobody
// holds by accident.

export type RankKey =
  | "doubt"
  | "intent"
  | "practice"
  | "discipline"
  | "unbroken";

export interface Rank {
  key: RankKey;
  name: string;
  /** Inclusive lower bound. */
  from: number;
  meaning: string;
}

export const RANKS: Rank[] = [
  { key: "doubt", name: "DOUBT", from: 0, meaning: "Your record does not back you" },
  { key: "intent", name: "INTENT", from: 100, meaning: "You have said what you will do" },
  { key: "practice", name: "PRACTICE", from: 350, meaning: "You are doing it, most of the time" },
  {
    key: "discipline",
    name: "DISCIPLINE",
    from: 600,
    meaning: "It holds when it is inconvenient",
  },
  { key: "unbroken", name: "UNBROKEN", from: 900, meaning: "The record has no meaningful gaps" },
];

/** Days without a single missed period before UNBROKEN earns its title. */
export const IMMACULATE_CLEAN_DAYS = 60;

export function rankFor(score: number): Rank {
  let found = RANKS[0];
  for (const rank of RANKS) {
    if (score >= rank.from) found = rank;
  }
  return found;
}

/**
 * The top band, and sixty days without a miss.
 *
 * `cleanDays` is the run of consecutive days on which nothing scheduled was
 * missed, in whichever scope the score belongs to. A day with nothing due does
 * not break it: not being scheduled is not a failure.
 */
export function isImmaculate(score: number, cleanDays: number): boolean {
  return rankFor(score).key === "unbroken" && cleanDays >= IMMACULATE_CLEAN_DAYS;
}

/** How many more clean days this record needs, or 0 when it already has them. */
export function daysToImmaculate(cleanDays: number): number {
  return Math.max(0, IMMACULATE_CLEAN_DAYS - cleanDays);
}

/**
 * The next rank up and how far away it is, or null at the top.
 *
 * A standing screen says "210 to UNBROKEN"; a list shows only the icon and the
 * number, because the colour already carries the rank (decision 40).
 */
export function nextRank(score: number): { rank: Rank; away: number } | null {
  const next = RANKS.find((r) => r.from > score);
  return next ? { rank: next, away: Math.ceil(next.from - score) } : null;
}
