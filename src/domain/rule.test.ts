import { describe, it, expect } from "vitest";
// From the barrel, not from ./registry: importing the registry alone leaves it
// empty, every type "missing", and the sweep over all twelve passing over
// nothing at all.
import { ruleFor, howOften, forgiven, dayStarts, registeredKeys, getActivityType } from "./index";
import type { ScheduleConfig } from "./schedule";

// The configure screen states the rule before it offers to change any of it,
// so these sentences are shipped copy for all twelve types. They get the same
// treatment as any other shipped copy.

const sched = (over: Partial<ScheduleConfig> = {}): ScheduleConfig => ({
  schedule: { kind: "days", days: [1, 2, 3, 4, 5, 6, 7] },
  dayBoundary: "midnight",
  grace: 2,
  minGap: 0,
  ...over,
});

describe("how often, in words", () => {
  it("names the shorthands rather than listing days", () => {
    // "Monday, Tuesday, Wednesday, Thursday and Friday" is the same fact and
    // nobody reads it.
    expect(howOften({ kind: "days", days: [1, 2, 3, 4, 5, 6, 7] })).toBe("every day");
    expect(howOften({ kind: "days", days: [1, 2, 3, 4, 5] })).toBe("every weekday");
    expect(howOften({ kind: "days", days: [6, 7] })).toBe("weekends");
  });

  it("lists the days when there is no shorthand", () => {
    expect(howOften({ kind: "days", days: [1, 3, 5] })).toBe("Monday, Wednesday and Friday");
    expect(howOften({ kind: "days", days: [3] })).toBe("every Wednesday");
  });

  it("orders the days whatever order they were stored in", () => {
    expect(howOften({ kind: "days", days: [5, 1, 3] })).toBe("Monday, Wednesday and Friday");
  });

  it("says a weekly minimum as a minimum", () => {
    expect(howOften({ kind: "minimum", perWeek: 3 })).toBe("any 3 days a week");
    expect(howOften({ kind: "minimum", perWeek: 1 })).toBe("any 1 day a week");
  });
});

describe("the engine's own footnotes", () => {
  it("says nothing about midnight, which everyone already assumes", () => {
    expect(dayStarts("midnight")).toBeNull();
  });

  it("explains noon, because only Sleep runs that way and it matters", () => {
    expect(dayStarts("noon")).toContain("noon to noon");
  });

  it("says nothing about grace when there is none", () => {
    expect(forgiven(0)).toBeNull();
  });

  it("counts grace in the singular and the plural", () => {
    expect(forgiven(1)).toContain("One miss");
    expect(forgiven(2)).toContain("2 misses");
  });
});

describe("the rule for a whole activity", () => {
  it("joins the schedule to the module's own clause", () => {
    expect(ruleFor("water", sched(), { glasses: 8 }).headline).toBe(
      "Every day: 8 glasses of water.",
    );
  });

  it("food states both halves of its rule, because both bind", () => {
    expect(ruleFor("food", sched(), { meals: 3, calorieLimit: 2000 }).headline).toBe(
      "Every day: 3 meals, under 2,000 calories.",
    );
  });

  it("and drops the calorie half when it is switched off", () => {
    const text = ruleFor("food", sched(), { meals: 3, calorieLimit: null }).headline;
    expect(text).toBe("Every day: 3 meals.");
    expect(text).not.toContain("calorie");
  });

  it("gym takes its how-often from the schedule, having none of its own", () => {
    const weekly = sched({ schedule: { kind: "minimum", perWeek: 4 } });
    expect(ruleFor("gym", weekly, {}).headline).toBe("Any 4 days a week: a session at the gym.");
  });

  it("sleep carries the noon note, and nothing else does", () => {
    const config = getActivityType("sleep").defaults.config;
    const noon = ruleFor("sleep", sched({ dayBoundary: "noon" }), config);
    expect(noon.notes.some((n) => n.includes("noon to noon"))).toBe(true);
    expect(ruleFor("water", sched(), { glasses: 8 }).notes.some((n) => n.includes("noon"))).toBe(
      false,
    );
  });

  it("nightfast says the cut-off and the window it is confirmed in", () => {
    const text = ruleFor("nightfast", sched(), {
      window: { open: "06:00", close: "11:00" },
      cutoff: "20:00",
    }).headline;
    expect(text).toBe("Every day: nothing after 8:00 PM, confirmed between 6:00 AM and 11:00 AM.");
  });

  it("carries the minimum gap only when one is set", () => {
    expect(ruleFor("water", sched(), { glasses: 8 }).notes.join(" ")).not.toContain("press");
    expect(ruleFor("water", sched({ minGap: 15 }), { glasses: 8 }).notes.join(" ")).toContain(
      "15 minutes have to pass",
    );
  });
});

describe("every type can say what it asks for", () => {
  it("all twelve write a clause, and none of them punctuates it itself", () => {
    // The engine joins these into a sentence and punctuates it, so a module
    // that ends its own clause with a full stop produces "...a day..".
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      const clause = type.summary(type.defaults.config);
      expect(clause.length, key).toBeGreaterThan(0);
      expect(clause.endsWith("."), key).toBe(false);
      expect(clause[0], key).toBe(clause[0]?.toLowerCase());
    }
  });

  it("and the whole sentence reads as one for every type", () => {
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      const { schedule, dayBoundary, grace } = type.defaults;
      const { headline } = ruleFor(key, sched({ schedule, dayBoundary, grace }), type.defaults.config);
      expect(headline.endsWith("."), key).toBe(true);
      expect(headline, key).not.toContain("..");
      expect(headline, key).not.toContain("undefined");
      expect(headline, key).not.toContain("null");
    }
  });
});
