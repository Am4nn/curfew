import { describe, it, expect } from "vitest";
import {
  consistency,
  AUTOMATIC_REPS,
  WINDOW_PERIODS,
  MIN_FOR_USUAL,
  type ConsistencyPeriod,
} from "./consistency";

// The number that replaces the streak (1.49). It is the one piece of Phase 2
// that can be wrong INVISIBLY: a percentage that looks plausible while
// measuring something other than what its label claims is the settling-day bug
// with a nicer label, and 3.4.1 cost a release to exactly that.
//
// So these are properties rather than remembered outputs. A test that asserts
// the string it was told to expect cannot notice that a sentence is false, and
// the same is true of a number.

const at = (minute: number): ConsistencyPeriod => ({ passed: true, minuteOfDay: minute });
const missed: ConsistencyPeriod = { passed: false, minuteOfDay: null };
/** Passed, but with no usable press time: a late log (C10). */
const late: ConsistencyPeriod = { passed: true, minuteOfDay: null };

/** `n` periods all passed at the same time of day. */
function run(n: number, minute = 7 * 60): ConsistencyPeriod[] {
  return Array.from({ length: n }, () => at(minute));
}

/** `n` periods missed. `Array(n).fill()` is `any[]` and the lint is right. */
function gap(n: number): ConsistencyPeriod[] {
  return Array.from({ length: n }, () => missed);
}

describe("consistency", () => {
  it("is null when nothing was scheduled, never zero", () => {
    // Nought of nought is no answer, not nought per cent. Monk mode carries
    // the same rule (1.16) and for the same reason: the screen has to draw a
    // dash rather than a number about no days.
    expect(consistency({ window: [], lifetimePassed: 0 })).toBeNull();
  });

  it("reads 100 only when the rate is perfect AND 66 have happened", () => {
    const perfectButYoung = consistency({
      window: run(WINDOW_PERIODS),
      lifetimePassed: 30,
    });
    expect(perfectButYoung!.rate).toBe(1);
    expect(perfectButYoung!.percent).toBe(Math.round((30 / AUTOMATIC_REPS) * 100));
    expect(perfectButYoung!.percent).toBeLessThan(100);

    const established = consistency({
      window: run(WINDOW_PERIODS),
      lifetimePassed: AUTOMATIC_REPS,
    });
    expect(established!.percent).toBe(100);
  });

  it("never exceeds 100, however long the run", () => {
    const veteran = consistency({
      window: run(WINDOW_PERIODS),
      lifetimePassed: 4000,
    });
    expect(veteran!.percent).toBe(100);
    expect(veteran!.repsToAutomatic).toBeNull();
  });

  // THE POINT OF THE WHOLE THING (C2, 1.49). A streak breaks on one miss and
  // the evidence says one missed day has no measurable effect on habit
  // formation. So this has to survive one, and survive it by a little.
  it("a single miss does not reset it, and barely moves it", () => {
    const clean = consistency({
      window: run(WINDOW_PERIODS),
      lifetimePassed: AUTOMATIC_REPS,
    })!;
    const oneMiss = consistency({
      window: [...run(WINDOW_PERIODS - 1), missed],
      lifetimePassed: AUTOMATIC_REPS,
    })!;

    expect(oneMiss.percent).toBeGreaterThan(0);
    expect(clean.percent - oneMiss.percent).toBeLessThanOrEqual(
      Math.ceil(100 / WINDOW_PERIODS),
    );
  });

  it("falls as misses accumulate, and only then", () => {
    const percentAfter = (misses: number) =>
      consistency({
        window: [...run(WINDOW_PERIODS - misses), ...gap(misses)],
        lifetimePassed: AUTOMATIC_REPS,
      })!.percent;

    // Monotonic, which is what makes the arrow on the row mean something.
    for (let m = 1; m <= WINDOW_PERIODS; m += 1) {
      expect(percentAfter(m)).toBeLessThan(percentAfter(m - 1));
    }
    expect(percentAfter(WINDOW_PERIODS)).toBe(0);
  });

  it("counts a miss by not counting it, rather than by subtracting", () => {
    // There is no branch in the file that asks what a miss does, and this is
    // what that buys: a window of thirty with ten misses is arithmetically the
    // same as a window of twenty with none.
    const withMisses = consistency({
      window: [...run(20), ...gap(10)],
      lifetimePassed: AUTOMATIC_REPS,
    })!;
    expect(withMisses.reps).toBe(20);
    expect(withMisses.scheduled).toBe(30);
    expect(withMisses.rate).toBeCloseTo(20 / 30);
  });

  it("counts a late log toward the rate and never toward the usual time", () => {
    // C10. A press at 11 PM for a lunch says when somebody remembered, not
    // when they acted. It is a real repetition and a false cue.
    const result = consistency({
      window: [...run(MIN_FOR_USUAL, 7 * 60), ...Array.from({ length: 5 }, () => late)],
      lifetimePassed: AUTOMATIC_REPS,
    })!;
    expect(result.reps).toBe(MIN_FOR_USUAL + 5);
    expect(result.usual).toEqual({ fromMinute: 7 * 60, toMinute: 7 * 60 });
  });

  it("says nothing about a usual time until there is enough to say it", () => {
    const tooFew = consistency({
      window: run(MIN_FOR_USUAL - 1),
      lifetimePassed: AUTOMATIC_REPS,
    })!;
    expect(tooFew.usual).toBeNull();

    const enough = consistency({
      window: run(MIN_FOR_USUAL),
      lifetimePassed: AUTOMATIC_REPS,
    })!;
    expect(enough.usual).not.toBeNull();
  });

  it("does not let one strange night widen the usual window", () => {
    // Median absolute deviation, not standard deviation. Six presses around
    // 7 AM and one at 3 AM is somebody with a 7 AM habit and one bad night.
    const tight = [...run(6, 7 * 60), at(3 * 60)];
    const result = consistency({ window: tight, lifetimePassed: AUTOMATIC_REPS })!;
    expect(result.usual!.fromMinute).toBe(7 * 60);
    expect(result.usual!.toMinute).toBe(7 * 60);
  });

  it("keeps the usual window inside one day", () => {
    const nearMidnight = [
      at(23 * 60 + 50),
      at(23 * 60 + 55),
      at(23 * 60 + 59),
      at(23 * 60 + 40),
      at(23 * 60 + 45),
    ];
    const result = consistency({ window: nearMidnight, lifetimePassed: AUTOMATIC_REPS })!;
    expect(result.usual!.fromMinute).toBeGreaterThanOrEqual(0);
    expect(result.usual!.toMinute).toBeLessThan(24 * 60);
  });

  it("counts down to automatic from what has happened, not from the window", () => {
    // Somebody who came back after a year is not starting again. What fell is
    // their rate, and that is what the number follows.
    const returning = consistency({
      window: [...run(5), ...gap(25)],
      lifetimePassed: AUTOMATIC_REPS + 200,
    })!;
    // The countdown finished long ago and says nothing now.
    expect(returning.repsToAutomatic).toBeNull();
    expect(returning.percent).toBe(Math.round((5 / 30) * 100));
  });

  it("is bounded, on any input a caller can build", () => {
    for (let reps = 0; reps <= WINDOW_PERIODS; reps += 1) {
      for (const lifetime of [0, 1, 33, 66, 500]) {
        const result = consistency({
          window: [...run(reps), ...gap(WINDOW_PERIODS - reps)],
          lifetimePassed: lifetime,
        })!;
        expect(result.percent).toBeGreaterThanOrEqual(0);
        expect(result.percent).toBeLessThanOrEqual(100);
        expect(result.repsToAutomatic ?? 0).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
