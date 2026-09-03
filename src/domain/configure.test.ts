import { describe, it, expect } from "vitest";
import { getActivityType, registeredKeys, scheduleConfigSchema } from "./index";
import { sleepActivity, sleepIssues } from "./sleep";
import { screenActivity } from "./screen";
import { stepsActivity } from "./steps";
import { readingActivity } from "./reading";

// The configure screen is drawn once for twelve types, so what each screen SAYS
// is a property of its module. These assertions are the V3Cfg* artboards: if a
// label here changes, a mock changed with it, deliberately.

const LABELS: Record<string, string[]> = {
  sleep: ["Night window", "Wake window", "Confirm window"],
  gym: [],
  food: ["Logs required", "Calorie limit"],
  supplements: ["Logs required"],
  office: ["Window"],
  study: ["Target"],
  steps: ["Rule", "Target"],
  water: ["Target"],
  reading: ["Count in", "Target"],
  screen: ["Rule", "Limit"],
  nightfast: ["Nothing after", "Confirm window"],
  sugarfree: ["Confirm window"],
};

describe("the twelve configure screens", () => {
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
            grace: type.defaults.grace,
          }),
        key,
      ).not.toThrow();
    }
  });

  it("state their evidence rule in their own words", () => {
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      expect(type.evidence.detail, key).not.toBe("");
      // "Photo required" and "No photo" are the engine's words; the sentence
      // under them belongs to the type.
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
      .find((f) => f.label === "Limit");
    expect(limit).toMatchObject({ kind: "number", unit: "hours", scale: 60 });
    // Two hours on the control is a hundred and twenty in the config.
    expect(screenActivity.defaults.config.limitMinutes).toBe(120);
  });

  it("the two threshold types offer their direction, and default opposite ways", () => {
    expect(stepsActivity.defaults.config.direction).toBe("atLeast");
    expect(screenActivity.defaults.config.direction).toBe("atMost");
  });

  it("Reading labels its target in the unit chosen above it", () => {
    const pages = readingActivity
      .fields({ unit: "pages", target: 30 })
      .find((f) => f.label === "Target");
    expect(pages).toMatchObject({ unit: "pages" });
    const minutes = readingActivity
      .fields({ unit: "minutes", target: 30 })
      .find((f) => f.label === "Target");
    expect(minutes).toMatchObject({ unit: "minutes" });
  });
});

describe("what the schema cannot say, the module says", () => {
  const base = {
    night_open: "22:00",
    night_close: "00:30",
    wake_open: "06:30",
    wake_close: "07:45",
    confirm_open: "07:45",
    confirm_close: "09:00",
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
