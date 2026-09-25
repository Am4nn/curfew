// A year of the consistency number, printed, with no database.
//
// WHY THIS EXISTS. `sim:push` was written because v3.3's notifications passed
// typecheck, lint, 301 tests and their own unit tests, and still told somebody
// with nothing logged that they were almost there. No function was wrong. The
// SENTENCE was, and a unit test cannot notice a sentence, because it asserts
// the string it was told to expect.
//
// The same is true of a number. `consistency.test.ts` asserts properties, and
// properties cannot tell you that 41% feels wrong for somebody six weeks into a
// perfect run. Only reading it can.
//
// THIS IS THE REVIEW GATE FOR 1.49. Read the output before changing a constant
// in `consistency.ts`. It needs nothing running.
import {
  consistency,
  AUTOMATIC_REPS,
  WINDOW_PERIODS,
  type ConsistencyPeriod,
} from "../src/domain/consistency";

const CUE = 7 * 60 + 20;

/** A press near the cue, give or take a few minutes. */
function on(drift = 0): ConsistencyPeriod {
  return { passed: true, minuteOfDay: CUE + drift };
}
const off: ConsistencyPeriod = { passed: false, minuteOfDay: null };

function clock(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * Walk a life day by day and print the number as it would have read.
 *
 * `days` is the whole history, oldest first. The window is the last
 * WINDOW_PERIODS of it, which is what the app would hand the function.
 */
function walk(
  title: string,
  note: string,
  days: ConsistencyPeriod[],
  marks: number[],
  unit = "day",
): void {
  console.log(`\n${title}`);
  console.log(`  ${note}`);
  console.log("");
  console.log(
    `   ${unit.padEnd(4)}   reps      rate   established   to automatic   usually`,
  );
  console.log("   ---------------------------------------------------------------------");
  for (const day of marks) {
    const history = days.slice(0, day);
    const result = consistency({
      window: history.slice(-WINDOW_PERIODS),
      lifetimePassed: history.filter((d) => d.passed).length,
    });
    if (!result) {
      console.log(`   ${String(day).padStart(4)}    nothing scheduled yet`);
      continue;
    }
    // Null once it is reached, so the row says nothing rather than "0".
    const left = result.repsToAutomatic === null ? "" : String(result.repsToAutomatic);
    const usual = result.usual
      ? `${clock(result.usual.fromMinute)} to ${clock(result.usual.toMinute)}`
      : "not yet";
    console.log(
      `   ${String(day).padStart(4)}  ${String(result.reps).padStart(3)}/${String(
        result.scheduled,
      ).padEnd(3)}  ${String(Math.round(result.rate * 100)).padStart(4)}%   ` +
        `${String(result.percent).padStart(8)}%   ${left.padStart(9)}` +
        `      ${usual}`,
    );
  }
}

console.log("=".repeat(75));
console.log("  THE CONSISTENCY NUMBER, 1.49");
console.log(`  ${AUTOMATIC_REPS} repetitions to automatic, rate over the last ${WINDOW_PERIODS}.`);
console.log("=".repeat(75));

// 1. The thing this has to get right: somebody doing it every single day.
walk(
  "A perfect run, from nothing",
  "This is the number a new member watches. If it feels wrong here, it is wrong.",
  Array.from({ length: 100 }, (_, i) => on((i % 7) - 3)),
  [1, 3, 7, 14, 21, 30, 45, 66, 80, 100],
);

// 2. The headline claim of 1.49. A streak would read 0 on day 41.
walk(
  "Forty days, then one missed",
  "A streak reads 0 the next morning. This is what the evidence says it should do.",
  [...Array.from({ length: 40 }, () => on(1)), off, ...Array.from({ length: 10 }, () => on(2))],
  [38, 39, 40, 41, 42, 45, 51],
);

// 3. Real life: a week away, then back.
walk(
  "Ninety good days, a week away, then back",
  "The fall should be visible and gradual, and the recovery should not start from zero.",
  [
    ...Array.from({ length: 90 }, () => on(-2)),
    ...Array.from({ length: 7 }, () => off),
    ...Array.from({ length: 20 }, () => on(3)),
  ],
  [90, 92, 94, 97, 100, 105, 110, 117],
);

// 4. The honest bad case. Somebody who logs sometimes.
walk(
  "Three days in five, for ever",
  "A real pattern, and the number should settle somewhere honest rather than climb.",
  Array.from({ length: 120 }, (_, i) => (i % 5 < 3 ? on((i % 11) - 5) : off)),
  [10, 30, 60, 90, 120],
);

// 5. Gym: a weekly period, so a "day" here is a week.
walk(
  "Gym, where a period is a WEEK",
  "66 repetitions is 66 weeks. Slow, and the alternative is a number that can never reach 100.",
  Array.from({ length: 80 }, () => on(0)),
  [4, 12, 26, 40, 66, 80],
  "week",
);

// 6. The cue, drifting.
walk(
  "Same rate, scattered times",
  "The percentage should NOT move. Only `usually` should widen: one number, one sentence.",
  Array.from({ length: 80 }, (_, i) => on(((i * 37) % 300) - 150)),
  [30, 60, 80],
);

console.log("");
console.log("=".repeat(75));
console.log("  Read it. The assertions in consistency.test.ts are the mechanical half");
console.log("  and they cannot tell you a number feels wrong.");
console.log("=".repeat(75));
