import { describe, it, expect } from "vitest";
import {
  applyDay,
  ceilingFor,
  joiningScore,
  replay,
  CONSTANTS,
  START_SCORE,
  MAX_SCORE,
  type ReplayDay,
} from "./reputation";

// REPUTATION.md's target properties are the spec; the constants are one way to
// hit them. These tests assert the properties, so tuning a constant that breaks
// one fails here rather than in someone's standing six months from now.
//
// Two of the targets cannot both be met. "350 in five weeks" and "600 in two
// months" ask for 150 points in five weeks and the next 250 in three, so the
// rate has to rise faster than "950 in seven to eight months" lets it fall.
// The bands below are the closest honest fit: 29, 73, 136 and 196 days.

const DAY = (n: number) => `2026-01-${String(n).padStart(2, "0")}`;

/** Perfect days at full breadth, from the starting score. */
function perfectRun(days: number, from = START_SCORE): number {
  const schedule: ReplayDay[] = Array.from({ length: days }, (_, i) => ({
    date: DAY(1 + (i % 28)),
    ceiling: MAX_SCORE,
    completion: 1,
    idleDays: 0,
  }));
  const rows = replay(from, schedule);
  return rows[rows.length - 1].score;
}

/** How many perfect days it takes to first reach `target`. */
function daysTo(target: number, from = START_SCORE): number {
  let score = from;
  let days = 0;
  while (score < target && days < 5000) {
    score = applyDay({ score, ceiling: MAX_SCORE, completion: 1, idleDays: 0 }).score;
    days += 1;
  }
  return days;
}

describe("the range holds", () => {
  it("never leaves 0 to 1000, whatever it is given", () => {
    const extremes = [
      { score: 0, ceiling: 1000, completion: 0, idleDays: 0 },
      { score: 1000, ceiling: 1000, completion: 1, idleDays: 0 },
      { score: 0, ceiling: 0, completion: null, idleDays: 400 },
      { score: 5, ceiling: 1000, completion: 0, idleDays: 0 },
    ];
    for (const input of extremes) {
      const { score } = applyDay(input);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1000);
    }
  });

  it("approaches 1000 without reaching it", () => {
    // Ten years of flawless days.
    expect(perfectRun(3650)).toBeLessThan(1000);
    expect(perfectRun(3650)).toBeGreaterThan(980);
  });
});

describe("the target properties", () => {
  it("first rank-up, 200 to 350, takes about five weeks", () => {
    const days = daysTo(350);
    expect(days).toBeGreaterThan(25);
    expect(days).toBeLessThan(50);
  });

  it("600 takes about two months", () => {
    const days = daysTo(600);
    expect(days).toBeGreaterThan(45);
    expect(days).toBeLessThan(85);
  });

  it("850 takes about four to five months", () => {
    const days = daysTo(850);
    expect(days).toBeGreaterThan(105);
    expect(days).toBeLessThan(170);
  });

  it("950 takes about seven to eight months", () => {
    const days = daysTo(950);
    expect(days).toBeGreaterThan(180);
    expect(days).toBeLessThan(270);
  });

  it("one missed day at the top costs about a week to recover", () => {
    const top = perfectRun(daysTo(900));
    const missed = applyDay({
      score: top,
      ceiling: MAX_SCORE,
      completion: 0,
      idleDays: 0,
    }).score;
    expect(missed).toBeLessThan(top);

    let score = missed;
    let days = 0;
    while (score < top && days < 100) {
      score = applyDay({ score, ceiling: MAX_SCORE, completion: 1, idleDays: 0 }).score;
      days += 1;
    }
    expect(days).toBeGreaterThanOrEqual(6);
    expect(days).toBeLessThanOrEqual(9);
  });

  it("one missed day near the start costs a couple of days", () => {
    const missed = applyDay({
      score: START_SCORE,
      ceiling: MAX_SCORE,
      completion: 0,
      idleDays: 0,
    }).score;
    let score = missed;
    let days = 0;
    while (score < START_SCORE && days < 100) {
      score = applyDay({ score, ceiling: MAX_SCORE, completion: 1, idleDays: 0 }).score;
      days += 1;
    }
    expect(days).toBeLessThanOrEqual(5);
  });

  it("abandoning a group for a month drifts down rather than staying high", () => {
    const top = perfectRun(daysTo(800));
    const quiet: ReplayDay[] = Array.from({ length: 30 }, (_, i) => ({
      date: DAY(1 + (i % 28)),
      ceiling: MAX_SCORE,
      completion: null,
      idleDays: i + 1,
    }));
    const after = replay(top, quiet).at(-1)!.score;
    expect(after).toBeLessThan(top - 50);
  });

  it("sharing one of five types caps around 400", () => {
    const ceiling = ceilingFor(1 / 5);
    expect(ceiling).toBe(400);
    // And a flawless year cannot climb past it.
    const rows = replay(
      START_SCORE,
      Array.from({ length: 365 }, (_, i) => ({
        date: DAY(1 + (i % 28)),
        ceiling,
        completion: 1,
        idleDays: 0,
      })),
    );
    expect(rows.at(-1)!.score).toBeLessThanOrEqual(ceiling);
  });
});

describe("breadth and the ceiling", () => {
  it("no breadth caps at 250, full breadth at 1000", () => {
    expect(ceilingFor(0)).toBe(250);
    expect(ceilingFor(1)).toBe(1000);
  });

  it("a ceiling that drops drifts the score down, with no cliff", () => {
    const rows = replay(
      800,
      Array.from({ length: 10 }, (_, i) => ({
        date: DAY(1 + i),
        ceiling: 600,
        completion: 1,
        idleDays: 0,
      })),
    );
    // Two a day, and a clean day does not rescue it while it is over.
    expect(rows[0].reason).toBe("drift");
    expect(rows[0].score).toBe(800 - CONSTANTS.drift);
    expect(rows.at(-1)!.score).toBe(800 - CONSTANTS.drift * 10);
  });

  it("drift stops exactly at the ceiling rather than overshooting", () => {
    const rows = replay(
      603,
      Array.from({ length: 5 }, (_, i) => ({
        date: DAY(1 + i),
        ceiling: 600,
        completion: null,
        idleDays: 0,
      })),
    );
    expect(rows.map((r) => r.score)).toEqual([601, 600, 600, 600, 600]);
  });

  it("un-sharing after a bad week does not scrub the damage", () => {
    // The exploit REPUTATION.md names: the loss is already in S, and a lower
    // ceiling only lowers what can be climbed back to.
    const good = perfectRun(daysTo(700));
    const bad = replay(
      good,
      Array.from({ length: 7 }, (_, i) => ({
        date: DAY(1 + i),
        ceiling: MAX_SCORE,
        completion: 0,
        idleDays: 0,
      })),
    ).at(-1)!.score;
    expect(bad).toBeLessThan(good);

    // Now un-share down to a lower ceiling. The score does not jump back up.
    const after = replay(bad, [
      { date: DAY(9), ceiling: 400, completion: 1, idleDays: 0 },
    ]).at(-1)!;
    expect(after.score).toBeLessThanOrEqual(bad);
  });
});

describe("quiet days", () => {
  it("a day with nothing scheduled is neutral, not a miss", () => {
    const result = applyDay({
      score: 500,
      ceiling: MAX_SCORE,
      completion: null,
      idleDays: 1,
    });
    expect(result.delta).toBe(0);
    expect(result.reason).toBe("neutral");
  });

  it("decay only starts once a week has passed with nothing due", () => {
    // A weekly activity has six quiet days; they must not decay it.
    const six = applyDay({
      score: 500,
      ceiling: MAX_SCORE,
      completion: null,
      idleDays: 6,
    });
    expect(six.reason).toBe("neutral");

    const seven = applyDay({
      score: 500,
      ceiling: MAX_SCORE,
      completion: null,
      idleDays: 7,
    });
    expect(seven.reason).toBe("idle");
    expect(seven.delta).toBe(-CONSTANTS.idle);
  });

  it("a partly complete day loses less than an empty one", () => {
    const half = applyDay({ score: 500, ceiling: MAX_SCORE, completion: 0.5, idleDays: 0 });
    const none = applyDay({ score: 500, ceiling: MAX_SCORE, completion: 0, idleDays: 0 });
    expect(half.delta).toBeLessThan(0);
    expect(half.delta).toBeGreaterThan(none.delta);
  });
});

describe("the joining score", () => {
  it("stays inside 100 to 300 whatever the global score", () => {
    expect(joiningScore(0)).toBe(100);
    expect(joiningScore(1000)).toBe(300);
    expect(joiningScore(500)).toBe(200);
  });

  it("a bad record cannot be escaped by leaving and rejoining", () => {
    // Someone who wrecked their global score rejoins below the default start.
    expect(joiningScore(50)).toBeLessThan(START_SCORE);
  });
});

describe("replay is the whole model", () => {
  it("a day depends on nothing but yesterday and today's facts", () => {
    const days: ReplayDay[] = [
      { date: DAY(1), ceiling: 1000, completion: 1, idleDays: 0 },
      { date: DAY(2), ceiling: 1000, completion: 0, idleDays: 0 },
      { date: DAY(3), ceiling: 1000, completion: 1, idleDays: 0 },
    ];
    const whole = replay(START_SCORE, days);
    const firstTwo = replay(START_SCORE, days.slice(0, 2));
    const rest = replay(firstTwo.at(-1)!.score, days.slice(2));
    expect(rest.at(-1)!.score).toBe(whole.at(-1)!.score);
  });
});
