import { describe, it, expect } from "vitest";
import { getActivityType, registeredKeys } from "./index";

describe("registry", () => {
  it("registers the sleep activity type", () => {
    expect(registeredKeys()).toContain("sleep");
    expect(getActivityType("sleep").key).toBe("sleep");
  });

  it("throws for an unknown key", () => {
    expect(() => getActivityType("gym")).toThrow();
  });
});
