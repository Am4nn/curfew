import { describe, it, expect } from "vitest";
import { getActivityType, registeredKeys, scheduleConfigSchema } from "./index";
import { sleepActivity, sleepIssues } from "./sleep";
import { screenActivity } from "./screen";
import { stepsActivity } from "./steps";
import { readingActivity } from "./reading";

// One screen, seventeen types, so what each screen says belongs to its module.
// These assertions are the mocks: a label changing here means a mock changed
// with it, deliberately.

const LABELS: Record<string, string[]> = {
  // The mock is V32SleepSetup. Confirm window is a `fixed` row: it states the
  // rule and offers no control, because it opens half an hour after the wake
  // press and is not a time anybody types (item 17).
  sleep: ["Night window", "Wake window", "Confirm window"],
  gym: [],
  // C9 put the bar under the aim, so the screen asks for both.
  food: ["Meals a day", "Counts as a miss under", "Calorie limit"],
  supplements: ["Doses a day"],
  office: ["Hours in the office"],
  study: ["Minutes a day"],
  steps: ["Pass when", "Steps a day"],
  water: ["Glasses a day"],
  reading: ["Counted in", "Amount a day"],
  screen: ["Pass when", "Hours a day"],
  nightfast: ["Nothing after", "Confirmed between"],
  sugarfree: ["Confirmed between"],

  // 3.1's five. Three of them ask nothing but when you confirm, which is the
  // whole point of the shape: they arrive under one Home row (1.19) and a
  // configure screen with one control is what makes five of them bearable.
  coldshower: ["Confirmed between"],
  sunlight: ["Counts as morning until", "Confirmed between"],
  junkfree: ["Confirmed between"],
  alcoholfree: ["Confirmed between"],
  socialfree: ["Nothing after", "Confirmed between"],

  // The template behind a condition somebody writes themselves. Its label is
  // chosen when it is created and is not a control here, which is why this
  // reads the same as the four plain ones.
  condition: ["Confirmed between"],
};

// Every one of these is a whole label, not a word the screen pads out. The
// configure screen asks each as a question and lists each beside its value, so
// "Target" was the engine asking what it wanted rather than a person asking
// what they wanted. A label that reads as a question and as a row label is the
// bar.

describe("the seventeen configure screens", () => {
  it("draw the controls their artboards draw, in that order", () => {
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      const labels = type.fields(type.defaults.config).map((f) => f.label);
      expect(labels, key).toEqual(LABELS[key]);
    }
  });

  it("prefill values their own schema accepts", () => {
    // The configure screen opens on these. A default that does not parse is a
    // screen that opens invalid.
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      expect(() => type.configSchema.parse(type.defaults.config), key).not.toThrow();
      expect(
        () =>
          scheduleConfigSchema.parse({
            schedule: type.defaults.schedule,
            dayBoundary: type.defaults.dayBoundary,
              }),
        key,
      ).not.toThrow();
    }
  });

  // 1.59. NEVER EXPLAIN AN ABSENCE. Nine types carried a line saying, in nine
  // wordings, that there is nothing to photograph and the app takes your word.
  // A struck-through camera beside "No photo" had already said it.
  //
  // So the rule inverts: a type that wants a photograph says what of, because
  // that is a fact somebody needs before pressing. A type that wants none says
  // nothing, and the assertion is that it says nothing.
  it("say what a photograph is for, and say nothing when there is none", () => {
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      if (type.evidence.level === "none") {
        expect(type.evidence.detail, key).toBeUndefined();
        continue;
      }
      expect(type.evidence.detail, key).not.toBe("");
      // "Photo required" is the engine's words; the sentence under it is the
      // type's own.
      expect(type.evidence.detail, key).toMatch(/\.$/);
    }
  });

  it("only Sleep states a fact about how it is judged", () => {
    const withFacts = registeredKeys().filter((k) => getActivityType(k).facts?.length);
    expect(withFacts).toEqual(["sleep"]);
    expect(sleepActivity.facts?.[0].title).toBe("Judged noon to noon");
  });

  it("Screen is stored in minutes and set in hours", () => {
    const limit = screenActivity
      .fields(screenActivity.defaults.config)
      .find((f) => f.label === "Hours a day");
    expect(limit).toMatchObject({ kind: "number", unit: "hours", scale: 60 });
    // Two hours on the control is a hundred and twenty in the config.
    expect(screenActivity.defaults.config.limitMinutes).toBe(120);
  });

  it("only Food asks for a bigger photo", () => {
    // Decision 97. A plate carries detail; a gym mirror does not.
    const bigger = registeredKeys().filter((k) => getActivityType(k).evidence.maxEdge);
    expect(bigger).toEqual(["food"]);
    expect(getActivityType("food").evidence).toMatchObject({ maxEdge: 2400, quality: 0.9 });
  });

  it("every type that takes a photo says where it may come from", () => {
    for (const key of registeredKeys()) {
      const rule = getActivityType(key).evidence;
      if (rule.level === "none") continue;
      expect(["live", "gallery"], key).toContain(rule.source);
    }
  });

  it("the two threshold types offer their direction, and default opposite ways", () => {
    expect(stepsActivity.defaults.config.direction).toBe("atLeast");
    expect(screenActivity.defaults.config.direction).toBe("atMost");
  });

  it("Reading labels its target in the unit chosen above it", () => {
    const pages = readingActivity
      .fields({ unit: "pages", target: 30 })
      .find((f) => f.label === "Amount a day");
    expect(pages).toMatchObject({ unit: "pages" });
    const minutes = readingActivity
      .fields({ unit: "minutes", target: 30 })
      .find((f) => f.label === "Amount a day");
    expect(minutes).toMatchObject({ unit: "minutes" });
  });
});

describe("what the schema cannot say, the module says", () => {
  // No confirm pair: it opens half an hour after the wake press (item 17), so
  // there is nothing here for a person to get wrong about it.
  const base = {
    night_open: "22:00",
    night_close: "00:30",
    wake_open: "06:30",
    wake_close: "07:45",
  };

  it("a good night has nothing wrong with it", () => {
    expect(sleepIssues(base)).toEqual([]);
  });

  it("marks a window that closes before it opens, on that window", () => {
    const issues = sleepIssues({ ...base, night_open: "23:00", night_close: "22:00" });
    expect(issues[0]).toEqual({
      path: "night_open",
      message: "The window closes before it opens.",
    });
  });

  it("marks an overlap on the window that moved into the other", () => {
    // Wake opening while the night window is still running.
    const issues = sleepIssues({ ...base, wake_open: "00:00", wake_close: "07:45" });
    expect(issues.map((i) => i.path)).toContain("wake_open");
    expect(issues.some((i) => i.message.includes("cannot share a minute"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The minimum gap is offered where it can refuse a press, and nowhere else.
//
// `repeats` is about the PERIOD and was the wrong question to ask. Gym's
// session repeats, because a week of three is not done after the first, so the
// configure screen offered "Time between logs" on an activity whose own
// `countsNow` already refuses the second press until tomorrow. Nothing caught
// it: a control that does nothing still renders, still saves, and still reads
// back what you set.
// ---------------------------------------------------------------------------
describe("which types can space their presses out", () => {
  const ANY_DAY = "2026-01-01";
  const spaceable = (key: string) => {
    const type = getActivityType(key);
    const config = type.configSchema.parse(type.defaults.config ?? {});
    return type.steps(config, ANY_DAY).some((s) => s.repeats && !s.oncePerDay);
  };

  it("gym cannot, because a session is once a calendar day", () => {
    expect(spaceable("gym")).toBe(false);
  });

  it("water and food can, because a day takes several", () => {
    expect(spaceable("water")).toBe(true);
    expect(spaceable("food")).toBe(true);
  });

  it("a type checked in once a period cannot", () => {
    expect(spaceable("office")).toBe(false);
    expect(spaceable("sleep")).toBe(false);
  });

  // The rule that makes the flag worth having rather than a special case for
  // gym: a step is only spaceable if two presses can land on the same day.
  it("every step declaring oncePerDay also repeats", () => {
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      const config = type.configSchema.parse(type.defaults.config ?? {});
      for (const step of type.steps(config, ANY_DAY)) {
        if (step.oncePerDay) expect(step.repeats).toBe(true);
      }
    }
  });
});
