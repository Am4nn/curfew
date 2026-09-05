import { describe, it, expect } from "vitest";
import { getActivityType, registeredKeys, daysDoneIn } from "./index";

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

  it("every registered type declares a complete envelope", () => {
    // The engine renders every screen from this declaration, so a module that
    // omits part of it fails at render time rather than here. Catch it here.
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      expect(type.name, `${key} name`).toMatch(/^\S+$/); // one word (decision 36)
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
      expect(type.defaults.grace, `${key} grace`).toBeGreaterThanOrEqual(0);
    }
  });

  it("every type's own defaults satisfy its own schema", () => {
    // A module that ships defaults its schema rejects cannot be added at all.
    for (const key of registeredKeys()) {
      const type = getActivityType(key);
      expect(() => type.configSchema.parse(type.defaults.config), key).not.toThrow();
    }
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
      config: { sessionsPerWeek: 3 },
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
      config: { sessionsPerWeek: 3 },
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
      config: { sessionsPerWeek: 3 },
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
        checkins: [],
      });
      // Nothing recorded, so either the period did not pass and no day counts,
      // or it passes on an empty period, in which case the day is the period.
      expect(empty.length === 0 || empty[0] === "2026-09-07").toBe(true);
    }
  });
});
