import { describe, it, expect } from "vitest";
import { getActivityType, registeredKeys, daysDoneIn, type Category } from "./index";
import { scheduleConfigSchema } from "./schedule";

describe("registry", () => {
  it("registers the two shapes the engine was built against", () => {
    // Sleep and Gym are the two shapes: a windowed day, and a weekly minimum.
    expect(registeredKeys()).toEqual(expect.arrayContaining(["sleep", "gym"]));
    expect(getActivityType("sleep").key).toBe("sleep");
    expect(getActivityType("gym").key).toBe("gym");
  });

  it("throws for an unknown key", () => {
    expect(() => getActivityType("kitesurfing")).toThrow();
  });

  // 1.16 requires Monk mode to cover a BODY, a FOOD, a MIND and a SLEEP, and
  // 1.19 says a condition somebody writes themselves has none, because nothing
  // can know whether "no doomscroll" is a MIND thing.
  //
  // So every type in the REGISTRY has one. A member-written condition never
  // reaches the registry: it is a `user_conditions` row read at runtime.
  it("every registered type belongs to one of the four categories", () => {
    const seen = new Set<Category>();
    for (const key of registeredKeys()) {
      const category = getActivityType(key).category;
      expect(category, `${key} category`).toBeDefined();
      seen.add(category as Category);
    }
    // Monk mode cannot be built at all unless all four are reachable.
    expect([...seen].sort()).toEqual(["body", "food", "mind", "sleep"]);
  });

  it("every registered type declares a complete envelope", () => {
    // The engine renders every screen from this declaration, so a module that
    // omits part of it fails at render time rather than here. Catch it here.
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      // v3 decision 36 said one word, and 3.1 reverses it: "Morning sunlight"
      // and "No social media" cannot be said in one, and Screen already proves
      // a one-word name can be the wrong one (3.1 keeps it apart from No
      // social media for exactly that reason).
      //
      // What the rule was protecting is the Home row, where the name sits at
      // 16px beside the streak pill and a control. That is a LENGTH, so this
      // asserts the length. Twenty leaves room on the narrowest phone and
      // still refuses a sentence. Longest today is "Morning sunlight", 16.
      expect(type.name.length, `${key} name`).toBeLessThanOrEqual(20);
      expect(type.name.trim(), `${key} name`).toBe(type.name);
      expect(type.description.length, `${key} description`).toBeGreaterThan(0);
      expect(type.icon.length, `${key} icon`).toBeGreaterThan(0);
      expect(["none", "optional", "required"]).toContain(type.evidence.level);
      expect(["live", "gallery"]).toContain(type.evidence.source);
      expect(["tap", "counter", "number", "camera", "declare"]).toContain(
        type.checkin.kind,
      );
      expect(["windowed", "numeric", "weekly", "binary"]).toContain(type.chart.kind);
      // The heading ships as it is written, in caps, so a module that forgets
      // it would put an empty label over its own chart.
      expect(type.chart.heading, `${key} chart heading`).toMatch(/^[A-Z0-9 ,'-]+$/);
      // A chart that plots a number has to say which number. Without this the
      // engine is back to guessing field names (invariant 6).
      if (type.chart.kind === "numeric" || type.chart.kind === "weekly") {
        expect(type.chart.valueField, `${key} chart valueField`).toBeTruthy();
        expect(type.chart.targetField, `${key} chart targetField`).toBeTruthy();
      }
    }
  });

  it("every type's own defaults satisfy its own schema", () => {
    // A module that ships defaults its schema rejects cannot be added at all.
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      expect(() => type.configSchema.parse(type.defaults.config), key).not.toThrow();
    }
  });

  it("every declared minGap is one the engine's schema will take", () => {
    // The module declares the number; the field is the engine's, and the
    // configure screen writes it back through this schema. A module declaring
    // 500 would prefill a screen that refuses to save.
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      const parse = () =>
        scheduleConfigSchema.parse({
          schedule: type.defaults.schedule,
          dayBoundary: type.defaults.dayBoundary,
          minGap: type.defaults.minGap ?? 0,
        });
      expect(parse, key).not.toThrow();
    }
  });

  it("water and meals ship with a wait between presses", () => {
    // The hole item 18 closes: eight glasses in eight seconds passed the day,
    // because the default was 0 for everything. These two are the types where
    // several of a thing in one day is the whole rule, so a plausible interval
    // is part of what the rule means. Every other type stays at 0 on purpose.
    expect(getActivityType("water").defaults.minGap).toBe(30);
    expect(getActivityType("food").defaults.minGap).toBe(90);
  });
});

describe("which days count toward a streak", () => {
  // The engine used to hand the streak one row per PERIOD. For a weekly type
  // that is a single Monday, which is below its own weekly minimum, so three
  // passed gym weeks reported a streak of 1. The module answers now.
  const IST = "Asia/Kolkata";
  const at = (day: string, hour: number) =>
    new Date(`${day}T${String(hour).padStart(2, "0")}:00:00+05:30`);

  it("gym counts a day per session day, not one for the week", () => {
    const days = daysDoneIn("gym", {
      periodStart: "2026-09-07",
      timezone: IST,
      config: {},
      schedule: { kind: "minimum", perWeek: 3 },
      checkins: [
        { step: "session", at: at("2026-09-07", 7) },
        { step: "session", at: at("2026-09-09", 19) },
        { step: "session", at: at("2026-09-11", 7) },
      ],
    });
    expect(days).toEqual(["2026-09-07", "2026-09-09", "2026-09-11"]);
  });

  it("two presses on one day at the gym are one day", () => {
    const days = daysDoneIn("gym", {
      periodStart: "2026-09-07",
      timezone: IST,
      config: {},
      schedule: { kind: "minimum", perWeek: 3 },
      checkins: [
        { step: "session", at: at("2026-09-08", 7) },
        { step: "session", at: at("2026-09-08", 20) },
      ],
    });
    expect(days).toEqual(["2026-09-08"]);
  });

  it("a short gym week still counts the days it did", () => {
    // The week is judged at week end by the engine. This only reports days.
    const days = daysDoneIn("gym", {
      periodStart: "2026-09-07",
      timezone: IST,
      config: {},
      schedule: { kind: "minimum", perWeek: 3 },
      checkins: [{ step: "session", at: at("2026-09-08", 7) }],
    });
    expect(days).toEqual(["2026-09-08"]);
  });

  it("a type that declares nothing counts its period when it passed", () => {
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      if (type.daysDone) continue;
      const empty = daysDoneIn(key, {
        periodStart: "2026-09-07",
        timezone: IST,
        config: type.defaults.config,
        schedule: type.defaults.schedule,
        checkins: [],
      });
      // Nothing recorded, so either the period did not pass and no day counts,
      // or it passes on an empty period, in which case the day is the period.
      expect(empty.length === 0 || empty[0] === "2026-09-07").toBe(true);
    }
  });
});
