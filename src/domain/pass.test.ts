import { describe, it, expect } from "vitest";
import { countPass, thresholdPass, sumField, latestField } from "./pass";

const at = (iso: string) => new Date(iso);

describe("countPass", () => {
  it("passes at the minimum", () => {
    const c = [
      { step: "a", at: at("2026-09-07T09:00Z") },
      { step: "a", at: at("2026-09-07T13:00Z") },
    ];
    expect(countPass(c, { min: 2 }).passed).toBe(true);
    expect(countPass(c, { min: 3 }).passed).toBe(false);
  });

  it("requires one per named step when steps are given", () => {
    const c = [
      { step: "night", at: at("2026-09-07T22:00Z") },
      { step: "wake", at: at("2026-09-08T06:40Z") },
    ];
    const r = countPass(c, { min: 3, steps: ["night", "wake", "confirm"] });
    expect(r.passed).toBe(false);
    expect(r.missingSteps).toEqual(["confirm"]);
  });

  it("a repeat of one step does not satisfy another", () => {
    const c = [
      { step: "night", at: at("2026-09-07T22:00Z") },
      { step: "night", at: at("2026-09-07T23:00Z") },
    ];
    expect(countPass(c, { min: 2, steps: ["night", "wake"] }).missingSteps).toEqual(["wake"]);
  });

  it("reports no missing steps when none are required", () => {
    expect(countPass([], { min: 0 }).missingSteps).toEqual([]);
  });
});

describe("thresholdPass, both directions", () => {
  it("atLeast passes at or above the target", () => {
    const rule = { direction: "atLeast" as const, target: 8000 };
    expect(thresholdPass(8000, rule).passed).toBe(true);
    expect(thresholdPass(8001, rule).passed).toBe(true);
    expect(thresholdPass(7999, rule).passed).toBe(false);
  });

  it("atMost passes at or below the limit", () => {
    const rule = { direction: "atMost" as const, target: 120 };
    expect(thresholdPass(120, rule).passed).toBe(true);
    expect(thresholdPass(119, rule).passed).toBe(true);
    expect(thresholdPass(121, rule).passed).toBe(false);
  });

  it("the boundary is inclusive in both directions", () => {
    // Steps and Screen must not disagree about what "at" means.
    expect(thresholdPass(100, { direction: "atLeast", target: 100 }).passed).toBe(true);
    expect(thresholdPass(100, { direction: "atMost", target: 100 }).passed).toBe(true);
  });
});

describe("count and threshold combine with AND", () => {
  // Food: at least three check-ins, and calories at or below the limit.
  const meals = [
    { step: "meal", at: at("2026-09-07T08:00Z"), evidence: { calories: 500 } },
    { step: "meal", at: at("2026-09-07T13:00Z"), evidence: { calories: 700 } },
    { step: "meal", at: at("2026-09-07T19:00Z"), evidence: { calories: 600 } },
  ];

  it("passes when both hold", () => {
    const count = countPass(meals, { min: 3 });
    const cals = thresholdPass(sumField(meals, "calories"), {
      direction: "atMost",
      target: 2000,
    });
    expect(count.passed && cals.passed).toBe(true);
    expect(cals.value).toBe(1800);
  });

  it("fails when only the count holds", () => {
    const cals = thresholdPass(sumField(meals, "calories"), {
      direction: "atMost",
      target: 1500,
    });
    expect(countPass(meals, { min: 3 }).passed && cals.passed).toBe(false);
  });
});

describe("sumField", () => {
  it("ignores check-ins with no evidence or a non-number", () => {
    const c = [
      { step: "a", at: at("2026-09-07T08:00Z"), evidence: { n: 5 } },
      { step: "a", at: at("2026-09-07T09:00Z") },
      { step: "a", at: at("2026-09-07T10:00Z"), evidence: { n: Number.NaN } },
      { step: "a", at: at("2026-09-07T11:00Z"), evidence: { n: 7 } },
    ];
    expect(sumField(c, "n")).toBe(12);
  });

  it("is zero for an empty period", () => {
    expect(sumField([], "n")).toBe(0);
  });
});

describe("latestField", () => {
  it("takes the last recorded value, not the last check-in", () => {
    const c = [
      { step: "a", at: at("2026-09-07T08:00Z"), evidence: { steps: 3000 } },
      { step: "a", at: at("2026-09-07T20:00Z"), evidence: { steps: 9000 } },
      { step: "a", at: at("2026-09-07T22:00Z") },
    ];
    expect(latestField(c, "steps")).toBe(9000);
  });

  it("is undefined when nothing was recorded", () => {
    expect(latestField([], "steps")).toBeUndefined();
  });

  it("does not assume input order", () => {
    const c = [
      { step: "a", at: at("2026-09-07T20:00Z"), evidence: { steps: 9000 } },
      { step: "a", at: at("2026-09-07T08:00Z"), evidence: { steps: 3000 } },
    ];
    expect(latestField(c, "steps")).toBe(9000);
  });
});
