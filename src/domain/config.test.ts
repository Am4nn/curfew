import { describe, it, expect } from "vitest";
import { resolveConfig, type EffectiveRow } from "./config";

interface Rule extends EffectiveRow {
  amount: number;
}

describe("resolveConfig", () => {
  it("returns the row in force on the period, not the latest overall", () => {
    // A future rule change must not rewrite a past period (invariant 5).
    const rows: Rule[] = [
      { scopeId: null, effectiveFrom: "2026-01-01", amount: 500 },
      { scopeId: null, effectiveFrom: "2026-09-15", amount: 1000 },
    ];
    expect(resolveConfig(rows, "2026-09-10")?.amount).toBe(500);
    expect(resolveConfig(rows, "2026-09-15")?.amount).toBe(1000);
    expect(resolveConfig(rows, "2026-09-20")?.amount).toBe(1000);
  });

  it("prefers a scope-specific row over the default", () => {
    const rows: Rule[] = [
      { scopeId: null, effectiveFrom: "2026-06-01", amount: 500 },
      { scopeId: "user-1", effectiveFrom: "2026-01-01", amount: 800 },
    ];
    // The user override wins even though the default is newer.
    expect(resolveConfig(rows, "2026-07-01")?.amount).toBe(800);
  });

  it("returns null when nothing is yet effective", () => {
    const rows: Rule[] = [
      { scopeId: null, effectiveFrom: "2026-09-15", amount: 1000 },
    ];
    expect(resolveConfig(rows, "2026-09-14")).toBeNull();
  });

  it("returns null for no rows", () => {
    expect(resolveConfig([] as Rule[], "2026-01-01")).toBeNull();
  });
});
