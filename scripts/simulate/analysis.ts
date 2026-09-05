// What the curve actually implies, worked out rather than guessed.
//
// Everything here runs `applyDay`, the same function the engine runs, over
// synthetic days. No database: these are questions about the shape of the
// curve, and the answers are the design's real answers rather than a
// description of them.
//
// The one worth reading twice is the equilibrium table. Reputation is a running
// score with shrinking gains and a loss stated in clean days, so any steady rate
// of missing settles at a level and stays there. That level, not the rank you
// once touched, is what a habit is worth.
import {
  applyDay,
  ceilingFor,
  rankFor,
  nextRank,
  RANKS,
  IMMACULATE_CLEAN_DAYS,
  START_SCORE,
  CONSTANTS,
  MAX_SCORE,
} from "@/domain";

/** Walk days, missing one in every `missOneIn` (0 means never miss). */
function walk(
  days: number,
  opts: { ceiling?: number; missOneIn?: number; from?: number } = {},
): number[] {
  const ceiling = opts.ceiling ?? ceilingFor(1);
  const missOneIn = opts.missOneIn ?? 0;
  let score = opts.from ?? START_SCORE;
  const out: number[] = [];
  for (let i = 0; i < days; i += 1) {
    // The settling week moves nothing, the same as the engine's first seven.
    const settling = i < CONSTANTS.settlingDays;
    const missed = missOneIn > 0 && i % missOneIn === missOneIn - 1;
    const result = applyDay({
      score,
      ceiling,
      completion: settling ? null : missed ? 0 : 1,
      idleDays: settling ? 1 : 0,
    });
    score = result.score;
    out.push(score);
  }
  return out;
}

export interface RankLadder {
  label: string;
  completion: string;
  /** Days from a standing start to each rank, or null if never reached. */
  toRank: { rank: string; days: number | null }[];
  /** The WORST the score gets once the pattern is steady: the level held. */
  settlesAt: number;
  /** The best it gets in the same cycle, right before the next miss. */
  peaksAt: number;
  settlesRank: string;
}

const DAYS = 4000;

/** How long each rank takes, and where this rate of missing settles. */
export function rankLadders(): RankLadder[] {
  const rates: { label: string; missOneIn: number; completion: string }[] = [
    { label: "Never miss", missOneIn: 0, completion: "100%" },
    { label: "Miss one day a month", missOneIn: 30, completion: "96.7%" },
    { label: "Miss one day a fortnight", missOneIn: 14, completion: "92.9%" },
    { label: "Miss one day a week", missOneIn: 7, completion: "85.7%" },
    { label: "Miss two days a week", missOneIn: 4, completion: "75%" },
    { label: "Miss every other day", missOneIn: 2, completion: "50%" },
  ];

  return rates.map((rate) => {
    const series = walk(DAYS, { missOneIn: rate.missOneIn });
    const toRank = [...RANKS.slice(1)].map(
      (r) => {
        const i = series.findIndex((s) => s >= r.from);
        return { rank: r.name, days: i === -1 ? null : i + 1 };
      },
    );
    // Where it settles. A steady rate of missing does not converge to a point,
    // it CYCLES: up through the clean days, down on the miss. The number that
    // matters is the bottom of that cycle, because that is the score you can
    // count on having. Reporting the peak instead read as "one slip a month
    // settles at 995" while the same pattern was demonstrably sitting below
    // IMMACULATE, which is how this was caught.
    const tail = series.slice(-Math.min(90, series.length));
    const settlesAt = Math.min(...tail);
    return {
      label: rate.label,
      completion: rate.completion,
      toRank,
      settlesAt,
      peaksAt: Math.max(...tail),
      settlesRank: rankFor(settlesAt).name,
    };
  });
}

export interface BreadthRow {
  accepted: number;
  sharedNeeded: number;
  ceilingIfAllShared: number;
  highestRank: string;
  immaculatePossible: boolean;
}

/**
 * Breadth is shared over accepted, and the ceiling is 250 + 750b. IMMACULATE
 * starts at 950, so it needs b >= 0.9333: you cannot buy the glow by sharing
 * one easy habit.
 */
export function breadthLadder(): BreadthRow[] {
  const needed = (RANKS[RANKS.length - 1].from - 250) / 750;
  return [1, 2, 3, 5, 8, 10, 12, 15, 20].map((accepted) => {
    const sharedNeeded = Math.ceil(needed * accepted - 1e-9);
    const ceiling = ceilingFor(1);
    return {
      accepted,
      sharedNeeded,
      ceilingIfAllShared: ceiling,
      highestRank: rankFor(ceiling).name,
      immaculatePossible: sharedNeeded <= accepted,
    };
  });
}

export interface PartialShareRow {
  shared: string;
  breadth: number;
  ceiling: number;
  highestRank: string;
  immaculate: boolean;
}

/** What sharing a fraction of what a group accepts caps you at. */
export function partialShareLadder(accepted = 6): PartialShareRow[] {
  return Array.from({ length: accepted + 1 }, (_, shared) => {
    const breadth = accepted === 0 ? 1 : shared / accepted;
    const ceiling = ceilingFor(breadth);
    return {
      shared: `${shared} of ${accepted}`,
      breadth,
      ceiling,
      highestRank: rankFor(ceiling).name,
      immaculate: ceiling >= RANKS[RANKS.length - 1].from,
    };
  });
}

export interface MissCost {
  atScore: number;
  rank: string;
  pointsLost: number;
  cleanDaysToUndo: number | null;
}

/** What one missed day costs, and how long it takes to earn back. */
export function missCosts(): MissCost[] {
  const ceiling = ceilingFor(1);
  return [200, 350, 500, 700, 850, 900, 950].map((atScore) => {
    const after = applyDay({ score: atScore, ceiling, completion: 0, idleDays: 0 });
    let score = after.score;
    let daysBack: number | null = null;
    for (let i = 1; i <= 400; i += 1) {
      score = applyDay({ score, ceiling, completion: 1, idleDays: 0 }).score;
      if (score >= atScore) {
        daysBack = i;
        break;
      }
    }
    return {
      atScore,
      rank: rankFor(atScore).name,
      pointsLost: Math.round(Math.abs(after.delta) * 10) / 10,
      cleanDaysToUndo: daysBack,
    };
  });
}

export interface HoldRow {
  rank: string;
  from: number;
  /** The worst steady rate of missing that still holds this rank. */
  worstRate: string | null;
}

/** What you have to keep up to STAY at each rank, which is the real question. */
export function holdRates(): HoldRow[] {
  const rates = [
    { label: "never missing", missOneIn: 0 },
    { label: "missing one day a month", missOneIn: 30 },
    { label: "missing one day in three weeks", missOneIn: 21 },
    { label: "missing one day a fortnight", missOneIn: 14 },
    { label: "missing one day in ten", missOneIn: 10 },
    { label: "missing one day a week", missOneIn: 7 },
    { label: "missing two days a week", missOneIn: 4 },
  ];
  // The bottom of the steady cycle: the score this rate can be counted on to
  // hold, rather than the one it touches on a good week.
  const settle = (missOneIn: number) => {
    const series = walk(DAYS, { missOneIn });
    return Math.min(...series.slice(-90));
  };
  const settled = rates.map((r) => ({ ...r, at: settle(r.missOneIn) }));

  return [...RANKS.slice(1)].map((rank) => {
    // The most forgiving rate whose settling point still clears this rank.
    const worst = [...settled].reverse().find((r) => r.at >= rank.from);
    return { rank: rank.name, from: rank.from, worstRate: worst?.label ?? null };
  });
}

export interface ClimbPoint {
  day: number;
  score: number;
}

/** The perfect climb, for the report's chart. */
export function perfectClimb(days = 900): ClimbPoint[] {
  return walk(days).map((score, i) => ({ day: i + 1, score }));
}

export interface Headline {
  question: string;
  answer: string;
}

/** The things a person actually wants to know, answered from the numbers. */
export function headlines(): Headline[] {
  const perfect = walk(DAYS);
  const dayTo = (target: number) => {
    const i = perfect.findIndex((s) => s >= target);
    return i === -1 ? null : i + 1;
  };
  const top = RANKS[RANKS.length - 1].from;
  const unbrokenDay = dayTo(top);
  const steady = (missOneIn: number) => {
    const tail = walk(DAYS, { missOneIn }).slice(-90);
    return { low: Math.min(...tail), high: Math.max(...tail) };
  };
  const monthly = steady(30);
  const weekly = steady(7);
  const needed = (top - 250) / 750;

  return [
    {
      question: "How long does IMMACULATE take, at best?",
      answer: unbrokenDay
        ? `${unbrokenDay} days of never missing to reach UNBROKEN (${top}), and IMMACULATE is that plus ${IMMACULATE_CLEAN_DAYS} days with nothing missed. Never missing satisfies both at once, so ${unbrokenDay} days, about ${Math.round(unbrokenDay / 30)} months.`
        : "Not reachable on this curve.",
    },
    {
      question: "Can you get there while keeping something private?",
      answer: `The ceiling is 250 + 750 x breadth, so the top band needs ${(needed * 100).toFixed(1)}% of what the group accepts. Share 5 of 6 and you are capped at ${ceilingFor(5 / 6).toFixed(0)}, which is ${rankFor(ceilingFor(5 / 6)).name} and no higher, so the glow is out of reach whatever the record.`,
    },
    {
      question: "What does missing one day a month cost?",
      answer: `It cycles between ${monthly.low.toFixed(0)} and ${monthly.high.toFixed(0)}, so the rank you can count on is ${rankFor(monthly.low).name}. IMMACULATE is out of reach at any rate of missing, because it asks for ${IMMACULATE_CLEAN_DAYS} days with no miss at all.`,
    },
    {
      question: "And one day a week?",
      answer: `Between ${weekly.low.toFixed(0)} and ${weekly.high.toFixed(0)}: ${rankFor(weekly.low).name}. A rate of missing does not converge to a point, it cycles, and the bottom of that cycle is what you actually hold.`,
    },
    {
      question: "Does a miss hurt more when you are high up?",
      answer: (() => {
        const low = applyDay({ score: 300, ceiling: ceilingFor(1), completion: 0, idleDays: 0 });
        const high = applyDay({ score: 900, ceiling: ceilingFor(1), completion: 0, idleDays: 0 });
        return `Yes. ${Math.abs(low.delta).toFixed(1)} points at 300, ${Math.abs(high.delta).toFixed(1)} at 900. The cost is stated in clean days, from about ${CONSTANTS.missCostDaysLow} at the bottom to ${CONSTANTS.missCostDaysHigh} at the top.`;
      })(),
    },
    {
      question: "Why can nobody reach 1000?",
      answer: `A day's gain is proportional to the headroom left, so it shrinks as the score climbs. ${MAX_SCORE} is approached and never touched. The top rank is the one above ${top}, and the title on top of it is earned by a clean run rather than a number.`,
    },
    {
      question: "What is the fastest way up?",
      answer: (() => {
        const next = nextRank(START_SCORE);
        return `Breadth first, then consistency. Sharing more raises the ceiling and every gain is scaled by the room under it, so a narrow perfect record climbs slower than a broad good one. From a standing start the first rank up, ${next?.rank.name}, is ${dayTo(next?.rank.from ?? 350)} days away at best.`;
      })(),
    },
  ];
}
