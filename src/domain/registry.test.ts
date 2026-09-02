import { describe, it, expect } from "vitest";
import { getActivityType, registeredKeys } from "./index";

describe("registry", () => {
  it("registers the two Phase 1 types", () => {
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
      expect(["windowed", "numeric", "weekly", "binary"]).toContain(type.chart);
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
