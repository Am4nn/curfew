import { describe, it, expect } from "vitest";
import { getActivityType, registeredKeys } from "./index";
import { foodActivity, FOOD_STEP } from "./food";
import { studyActivity, STUDY_STEP } from "./study";
import { stepsActivity, STEPS_STEP } from "./steps";
import { waterActivity, WATER_STEP } from "./water";
import { readingActivity, READING_STEP } from "./reading";
import { nightfastActivity } from "./nightfast";
import { sugarfreeActivity } from "./sugarfree";
import { DECLARE_STEP } from "./abstinence";
import { clockLabel } from "./windows";

// The sentences that ship, asserted verbatim against the mocks.

const IST = "Asia/Kolkata";
const DAY = "2026-09-07";
const at = (hhmm: string) => new Date(`${DAY}T${hhmm}+05:30`);
const check = (step: string, hhmm: string, evidence?: Record<string, unknown>) => ({
  step,
  at: at(hhmm),
  evidence: evidence as never,
});

describe("every type can be checked in", () => {
  it("declares at least one step, with a window to match", () => {
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      const steps = type.steps(type.defaults.config, DAY);
      expect(steps.length, key).toBeGreaterThan(0);
      const windows = type.windows(type.defaults.config, DAY, IST);
      for (const step of steps) {
        expect(windows.map((w) => w.step), key).toContain(step.key);
      }
    }
  });

  it("names which steps may happen more than once a period", () => {
    const repeating = registeredKeys().filter((key) => {
      const type = getActivityType(key);
      return type.steps(type.defaults.config, DAY).some((s) => s.repeats);
    });
    // Office arrives once, a gym session is one a day, and each sleep window
    // happens once a night. Everything else can honestly happen again.
    expect(repeating.sort()).toEqual([
      "food",
      "nightfast",
      "reading",
      "screen",
      "steps",
      "study",
      "sugarfree",
      "supplements",
      "water",
    ]);
  });

  it("asks for a number wherever the evidence carries one", () => {
    const withFields = registeredKeys().filter((key) => {
      const type = getActivityType(key);
      return type.steps(type.defaults.config, DAY).some((s) => s.fields?.length);
    });
    expect(withFields.sort()).toEqual(["food", "reading", "screen", "steps", "study"]);
  });
});

describe("the line under the fields, in the module's own words", () => {
  const hint = (
    activity: typeof studyActivity,
    step: string,
    checkins: ReturnType<typeof check>[],
    config: never,
    pending?: Record<string, number> | null,
  ) =>
    activity.hint?.({
      periodStart: DAY,
      timezone: IST,
      config,
      checkins,
      step,
      pending: pending ?? null,
    });

  it("Study states the target before anything is recorded", () => {
    // The mock, word for word.
    expect(
      hint(studyActivity, STUDY_STEP, [], { minutesTarget: 45 } as never),
    ).toBe("Target is 45. Anything at or above counts.");
  });

  it("Study counts the sittings once there are some", () => {
    expect(
      hint(
        studyActivity,
        STUDY_STEP,
        [check(STUDY_STEP, "09:00", { minutes: 20 })],
        { minutesTarget: 60 } as never,
      ),
    ).toBe("20 of 60 so far today.");
  });

  it("Food reports what is recorded, then what sending would make it", () => {
    const meals = [
      check(FOOD_STEP, "08:00", { calories: 480 }),
      check(FOOD_STEP, "13:00", { calories: 700 }),
    ];
    const config = { meals: 3, calorieLimit: 2000 } as never;
    // Both lines are on the mocks.
    expect(foodActivity.hint?.({
      periodStart: DAY, timezone: IST, config, checkins: meals,
      step: FOOD_STEP, pending: null,
    })).toBe("1180 so far today. The limit is 2000.");

    expect(foodActivity.hint?.({
      periodStart: DAY, timezone: IST, config, checkins: meals,
      step: FOOD_STEP, pending: { calories: 520 },
    })).toBe("1700 of 2000 once this is sent.");
  });

  it("Water counts glasses against the target", () => {
    expect(
      waterActivity.hint?.({
        periodStart: DAY,
        timezone: IST,
        config: { glasses: 8 },
        checkins: [check(WATER_STEP, "08:00"), check(WATER_STEP, "10:00")],
        step: WATER_STEP,
        pending: null,
      }),
    ).toBe("2 of 8 today.");
  });

  it("Steps says a later reading replaces the earlier one, not adds to it", () => {
    expect(
      stepsActivity.hint?.({
        periodStart: DAY,
        timezone: IST,
        config: { target: 8000, direction: "atLeast" },
        checkins: [
          check(STEPS_STEP, "12:00", { steps: 3000 }),
          check(STEPS_STEP, "21:00", { steps: 9000 }),
        ],
        step: STEPS_STEP,
        pending: null,
      }),
    ).toBe("9,000 recorded so far. The target is 8,000.");
  });

  it("Reading names the unit the user chose", () => {
    expect(
      readingActivity.hint?.({
        periodStart: DAY,
        timezone: IST,
        config: { unit: "pages", target: 30 },
        checkins: [check(READING_STEP, "09:00", { amount: 20 })],
        step: READING_STEP,
        pending: { amount: 10 },
      }),
    ).toBe("30 of 30 pages once this is sent.");
  });
});

describe("the abstinence question", () => {
  it("names the cut-off in 12-hour time", () => {
    const [step] = nightfastActivity.steps(nightfastActivity.defaults.config, DAY);
    // The mock.
    expect(step.prompt).toBe("Nothing after 8:00 PM last night. Did it hold?");
    expect(step.key).toBe(DECLARE_STEP);
  });

  it("carries the same two lines under and beneath it", () => {
    const [step] = sugarfreeActivity.steps(sugarfreeActivity.defaults.config, DAY);
    expect(step.prompt).toBe("No sugar today. Did it hold?");
    expect(step.aside).toContain("Nobody can check this one.");
    expect(step.consequence).toContain("breaks the streak");
  });

  it("sugar-free has no cut-off, nightfast does", () => {
    expect(sugarfreeActivity.defaults.config).toMatchObject({ cutoff: null });
    expect(nightfastActivity.defaults.config).toMatchObject({ cutoff: "20:00" });
  });

  it("offers the cut-off as a control only where there is one", () => {
    const nightfast = nightfastActivity.fields(nightfastActivity.defaults.config);
    const sugarfree = sugarfreeActivity.fields(sugarfreeActivity.defaults.config);
    expect(nightfast.some((f) => f.kind === "time")).toBe(true);
    expect(sugarfree.some((f) => f.kind === "time")).toBe(false);
  });
});

describe("clock labels", () => {
  it("reads midnight and noon the way a person does", () => {
    expect(clockLabel("00:00")).toBe("12:00 AM");
    expect(clockLabel("12:00")).toBe("12:00 PM");
    expect(clockLabel("07:45")).toBe("7:45 AM");
    expect(clockLabel("23:59")).toBe("11:59 PM");
  });
});
