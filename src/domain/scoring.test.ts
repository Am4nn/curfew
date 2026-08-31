import { describe, it, expect } from "vitest";
import { fineFor, scoreChain, type FineRules, type ChainPeriod } from "./scoring";

const flat: FineRules = { fineMode: "flat", fineAmount: 5000, fineStep: 0, fineCap: null };

function period(
  periodStart: string,
  passed: boolean,
  rules: FineRules = flat,
  gracePerMonth = 2,
): ChainPeriod {
  return { periodStart, passed, gracePerMonth, rules };
}

describe("fineFor", () => {
  it("flat mode is always the base amount", () => {
    expect(fineFor(flat, 0)).toBe(5000);
    expect(fineFor(flat, 4)).toBe(5000);
  });

  it("escalating adds step per prior consecutive failure", () => {
    const esc: FineRules = { fineMode: "escalating", fineAmount: 5000, fineStep: 2500, fineCap: null };
    expect(fineFor(esc, 0)).toBe(5000);
    expect(fineFor(esc, 1)).toBe(7500);
    expect(fineFor(esc, 3)).toBe(12500);
  });

  it("escalating is capped", () => {
    const esc: FineRules = { fineMode: "escalating", fineAmount: 5000, fineStep: 2500, fineCap: 10000 };
    expect(fineFor(esc, 10)).toBe(10000);
  });
});

describe("scoreChain", () => {
  it("counts consecutive passing days", () => {
    const out = scoreChain([
      period("2026-08-01", true),
      period("2026-08-02", true),
      period("2026-08-03", true),
    ]);
    expect(out.map((o) => o.streakAfter)).toEqual([1, 2, 3]);
  });

  it("grace absorbs a miss and holds the streak, fine still applies", () => {
    const out = scoreChain([
      period("2026-08-01", true),
      period("2026-08-02", true),
      period("2026-08-03", false), // graced
      period("2026-08-04", true),
    ]);
    expect(out.map((o) => o.streakAfter)).toEqual([1, 2, 2, 3]);
    expect(out.map((o) => o.graceUsed)).toEqual([false, false, true, false]);
    expect(out[2].fineAmount).toBe(5000); // grace protects the chain, not the wallet
  });

  it("exhausts grace within a month then resets the streak", () => {
    const out = scoreChain([
      period("2026-08-01", true),
      period("2026-08-02", false), // grace 1
      period("2026-08-03", false), // grace 2
      period("2026-08-04", false), // no grace left -> reset
    ]);
    expect(out.map((o) => o.graceUsed)).toEqual([false, true, true, false]);
    expect(out.map((o) => o.streakAfter)).toEqual([1, 1, 1, 0]);
    // every miss is fined
    expect(out.slice(1).every((o) => o.fineAmount === 5000)).toBe(true);
  });

  it("resets grace at the calendar month boundary", () => {
    const out = scoreChain([
      period("2026-08-30", false), // Aug grace 1
      period("2026-08-31", false), // Aug grace 2
      period("2026-09-01", false), // Sep grace 1 -> absorbed
    ]);
    expect(out.map((o) => o.graceUsed)).toEqual([true, true, true]);
  });

  it("resolves each period's fine from its own rules (mid-range change untouched)", () => {
    const cheap: FineRules = { fineMode: "flat", fineAmount: 500, fineStep: 0, fineCap: null };
    const dear: FineRules = { fineMode: "flat", fineAmount: 1000, fineStep: 0, fineCap: null };
    const out = scoreChain([
      period("2026-09-14", false, cheap, 0),
      period("2026-09-15", false, dear, 0),
    ]);
    expect(out.map((o) => o.fineAmount)).toEqual([500, 1000]);
  });
});
