// Ranks are bands on the reputation score. See `.planning/v3/RANKS.md`.
//
// IMMACULATE is a title inside UNBROKEN, not a sixth band: it carries the only
// glow in the app, which is what makes it mean anything.

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
  { key: "unbroken", name: "UNBROKEN", from: 850, meaning: "The record has no meaningful gaps" },
];

/** The score at which UNBROKEN earns its title, and the app's only glow. */
export const IMMACULATE_FROM = 950;

export function rankFor(score: number): Rank {
  let found = RANKS[0];
  for (const rank of RANKS) {
    if (score >= rank.from) found = rank;
  }
  return found;
}

export function isImmaculate(score: number): boolean {
  return score >= IMMACULATE_FROM;
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
