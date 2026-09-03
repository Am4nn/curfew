import { describe, it, expect } from "vitest";
import { getActivityType, registeredKeys } from "./index";
import { foodActivity, FOOD_STEP } from "./food";
import { supplementsActivity, SUPPLEMENTS_STEP } from "./supplements";
import { officeActivity, OFFICE_STEP } from "./office";
import { studyActivity, STUDY_STEP } from "./study";
import { stepsActivity, STEPS_STEP } from "./steps";
import { waterActivity, WATER_STEP } from "./water";
import { readingActivity, READING_STEP } from "./reading";
import { screenActivity, SCREEN_STEP } from "./screen";
import { nightfastActivity } from "./nightfast";
import { sugarfreeActivity } from "./sugarfree";
import { DECLARE_STEP } from "./abstinence";
import { windowInstants } from "./windows";

const IST = "Asia/Kolkata";
const DAY = "2026-09-07";

const at = (hhmm: string) => new Date(`${DAY}T${hhmm}+05:30`);

function check(step: string, hhmm: string, evidence?: Record<string, unknown>) {
  return { step, at: at(hhmm), evidence: evidence as never };
}

describe("the catalog is complete", () => {
  it("registers all twelve types", () => {
    expect(registeredKeys()).toHaveLength(12);
  });

  it("covers all five check-in kinds", () => {
    const kinds = new Set(registeredKeys().map((k) => getActivityType(k).checkin.kind));
    expect([...kinds].sort()).toEqual(["camera", "counter", "declare", "number", "tap"]);
  });

  it("no type key collides", () => {
    expect(new Set(registeredKeys()).size).toBe(registeredKeys().length);
  });
});

describe("Food, the only type needing both pass shapes", () => {
  const evaluate = (checkins: ReturnType<typeof check>[], config = foodActivity.defaults.config) =>
    foodActivity.evaluate({ periodStart: DAY, timezone: IST, config, checkins });

  const meal = (hhmm: string, calories: number) =>
    check(FOOD_STEP, hhmm, { calories });

  it("passes on enough meals under the limit", () => {
    const r = evaluate([meal("08:00", 500), meal("13:00", 700), meal("19:00", 600)]);
    expect(r.passed).toBe(true);
    expect(r.detail.calories).toBe(1800);
  });

  it("fails on too few meals even when calories are fine", () => {
    expect(evaluate([meal("08:00", 400), meal("13:00", 400)]).passed).toBe(false);
  });

  it("fails on enough meals over the limit", () => {
    const r = evaluate([meal("08:00", 900), meal("13:00", 900), meal("19:00", 900)]);
    expect(r.passed).toBe(false);
    expect(r.detail.calories).toBe(2700);
  });

  it("with no limit set, only the meal count binds", () => {
    const config = { meals: 3, calorieLimit: null };
    const r = evaluate([meal("08:00", 5000), meal("13:00", 5000), meal("19:00", 5000)], config);
    expect(r.passed).toBe(true);
    expect(r.detail.limit).toBeNull();
  });

  it("an empty day fails", () => {
    expect(evaluate([]).passed).toBe(false);
  });
});

describe("Study, target when set", () => {
  const evaluate = (checkins: ReturnType<typeof check>[], minutesTarget: number | null) =>
    studyActivity.evaluate({
      periodStart: DAY,
      timezone: IST,
      config: { minutesTarget },
      checkins,
    });

  const session = (hhmm: string, minutes: number) => check(STUDY_STEP, hhmm, { minutes });

  it("sittings add up to the target", () => {
    expect(evaluate([session("09:00", 20), session("14:00", 25), session("20:00", 20)], 60).passed).toBe(true);
  });

  it("under the target fails, even with a check-in", () => {
    // The whole point of decision 86: the target actually binds.
    const r = evaluate([session("09:00", 5)], 60);
    expect(r.passed).toBe(false);
    expect(r.detail.minutes).toBe(5);
  });

  it("with no target, one check-in passes whatever the minutes", () => {
    expect(evaluate([session("09:00", 5)], null).passed).toBe(true);
  });

  it("with no target and no check-in, it still fails", () => {
    expect(evaluate([], null).passed).toBe(false);
  });
});

describe("Steps and Screen, the two threshold directions", () => {
  const steps = (checkins: ReturnType<typeof check>[], target = 8000) =>
    stepsActivity.evaluate({
      periodStart: DAY,
      timezone: IST,
      config: { target, direction: "atLeast" },
      checkins,
    });

  const screen = (checkins: ReturnType<typeof check>[], limitMinutes = 120) =>
    screenActivity.evaluate({
      periodStart: DAY,
      timezone: IST,
      config: { limitMinutes, direction: "atMost" },
      checkins,
    });

  it("steps passes at or above", () => {
    expect(steps([check(STEPS_STEP, "21:00", { steps: 8000 })]).passed).toBe(true);
    expect(steps([check(STEPS_STEP, "21:00", { steps: 7999 })]).passed).toBe(false);
  });

  it("screen passes at or below", () => {
    expect(screen([check(SCREEN_STEP, "23:00", { minutes: 120 })]).passed).toBe(true);
    expect(screen([check(SCREEN_STEP, "23:00", { minutes: 121 })]).passed).toBe(false);
  });

  it("takes the latest reading rather than summing", () => {
    // A phone reports a running total, so adding two readings double-counts the
    // morning. 3000 then 9000 is nine thousand steps, not twelve.
    const r = steps([
      check(STEPS_STEP, "12:00", { steps: 3000 }),
      check(STEPS_STEP, "21:00", { steps: 9000 }),
    ]);
    expect(r.detail.steps).toBe(9000);
    expect(r.passed).toBe(true);
  });

  it("screen with no reading is a miss, not a pass", () => {
    // Silence must never pass (invariant 2). Nothing reported is not "under the
    // limit", or deleting the app would be the winning move.
    const r = screen([]);
    expect(r.passed).toBe(false);
    expect(r.detail.minutes).toBeNull();
  });
});

describe("Water, the counter", () => {
  const evaluate = (n: number, glasses = 8) =>
    waterActivity.evaluate({
      periodStart: DAY,
      timezone: IST,
      config: { glasses },
      checkins: Array.from({ length: n }, (_, i) =>
        check(WATER_STEP, `${String(8 + (i % 12)).padStart(2, "0")}:00`),
      ),
    });

  it("passes on the target", () => {
    expect(evaluate(8).passed).toBe(true);
  });

  it("fails below it", () => {
    expect(evaluate(7).passed).toBe(false);
  });

  it("carries no evidence at all", () => {
    expect(waterActivity.evidence.level).toBe("none");
  });
});

describe("Reading, one unit at a time", () => {
  const evaluate = (amounts: number[], unit: "minutes" | "pages", target: number) =>
    readingActivity.evaluate({
      periodStart: DAY,
      timezone: IST,
      config: { unit, target },
      checkins: amounts.map((amount, i) =>
        check(READING_STEP, `${String(9 + i).padStart(2, "0")}:00`, { amount }),
      ),
    });

  it("sittings add up", () => {
    const r = evaluate([20, 10], "pages", 30);
    expect(r.passed).toBe(true);
    expect(r.detail.amount).toBe(30);
  });

  it("reports the unit so the chart can label itself", () => {
    expect(evaluate([45], "minutes", 30).detail.unit).toBe("minutes");
  });

  it("rejects a config carrying both units", () => {
    expect(() =>
      readingActivity.configSchema.parse({ unit: "minutes", target: 30, pages: 20 }),
    ).toThrow();
  });
});

describe("Office, inside the window", () => {
  const evaluate = (checkins: ReturnType<typeof check>[]) =>
    officeActivity.evaluate({
      periodStart: DAY,
      timezone: IST,
      config: officeActivity.defaults.config,
      checkins,
    });

  it("a press inside the window counts", () => {
    expect(evaluate([check(OFFICE_STEP, "11:00")]).passed).toBe(true);
  });

  it("a press after it does not", () => {
    // Arriving at 6pm is not arriving by 2pm.
    const r = evaluate([check(OFFICE_STEP, "18:00")]);
    expect(r.passed).toBe(false);
    expect(r.detail.presses).toBe(1);
  });

  it("a press before it does not", () => {
    expect(evaluate([check(OFFICE_STEP, "09:00")]).passed).toBe(false);
  });

  it("defaults to weekdays, so the engine skips the weekend", () => {
    expect(officeActivity.defaults.schedule).toEqual({ kind: "days", days: [1, 2, 3, 4, 5] });
  });
});

describe("Supplements, once a day with no window", () => {
  it("one dose passes", () => {
    const r = supplementsActivity.evaluate({
      periodStart: DAY,
      timezone: IST,
      config: { dosesPerDay: 1 },
      checkins: [check(SUPPLEMENTS_STEP, "03:00")],
    });
    expect(r.passed).toBe(true);
  });

  it("accepts a check-in at any hour, since there is no right time", () => {
    const [w] = supplementsActivity.windows(
      supplementsActivity.defaults.config,
      DAY,
      IST,
    );
    const span = (w.closesAt.getTime() - w.opensAt.getTime()) / 3_600_000;
    expect(span).toBe(24);
  });
});

describe("abstinence types", () => {
  const declare = (activity: typeof nightfastActivity, hhmm: string, held: boolean) =>
    activity.evaluate({
      periodStart: DAY,
      timezone: IST,
      config: activity.defaults.config,
      checkins: [check(DECLARE_STEP, hhmm, { held })],
    });

  it("silence is a miss, not a pass", () => {
    // The reason these types check in at all (decision 50). Without this the
    // app would reward deleting it and coming back to a 90-day streak.
    const r = nightfastActivity.evaluate({
      periodStart: DAY,
      timezone: IST,
      config: nightfastActivity.defaults.config,
      checkins: [],
    });
    expect(r.passed).toBe(false);
    expect(r.detail.declared).toBe(false);
  });

  it("it held passes, I slipped does not", () => {
    expect(declare(nightfastActivity, "08:00", true).passed).toBe(true);
    expect(declare(nightfastActivity, "08:00", false).passed).toBe(false);
  });

  it("a declaration outside the window does not count", () => {
    // Nightfast is declared in the morning: you cannot honestly declare a night
    // you are still in.
    expect(declare(nightfastActivity, "23:00", true).passed).toBe(false);
  });

  it("the last word wins, so a correction is taken", () => {
    const r = nightfastActivity.evaluate({
      periodStart: DAY,
      timezone: IST,
      config: nightfastActivity.defaults.config,
      checkins: [
        check(DECLARE_STEP, "07:00", { held: true }),
        check(DECLARE_STEP, "09:00", { held: false }),
      ],
    });
    expect(r.passed).toBe(false);
  });

  it("carries no evidence, because absence cannot be photographed", () => {
    expect(nightfastActivity.evidence.level).toBe("none");
    expect(sugarfreeActivity.evidence.level).toBe("none");
  });

  it("sugar-free is declared in the evening instead", () => {
    expect(declare(sugarfreeActivity, "21:00", true).passed).toBe(true);
    expect(declare(sugarfreeActivity, "08:00", true).passed).toBe(false);
  });
});

describe("windows crossing midnight", () => {
  it("a close at or before the open lands on the next day", () => {
    const { opensAt, closesAt } = windowInstants(DAY, IST, { open: "22:00", close: "00:30" });
    expect(closesAt.getTime()).toBeGreaterThan(opensAt.getTime());
    expect((closesAt.getTime() - opensAt.getTime()) / 60_000).toBe(150);
  });

  it("an all-day window is a full twenty-four hours", () => {
    const { opensAt, closesAt } = windowInstants(DAY, IST, { open: "00:00", close: "00:00" });
    expect((closesAt.getTime() - opensAt.getTime()) / 3_600_000).toBe(24);
  });
});
