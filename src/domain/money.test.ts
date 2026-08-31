import { describe, it, expect } from "vitest";
import { splitFine, minorUnitExponent, formatMoney } from "./money";

describe("splitFine", () => {
  it("distributes the remainder one minor unit at a time, ordered by id", () => {
    const shares = splitFine(5000, ["a", "b", "c"]);
    expect(shares.map((s) => s.amount)).toEqual([1667, 1667, 1666]);
    expect(shares.reduce((t, s) => t + s.amount, 0)).toBe(5000);
  });

  it("orders recipients by id regardless of input order", () => {
    const shares = splitFine(5000, ["c", "a", "b"]);
    expect(shares.map((s) => s.toUserId)).toEqual(["a", "b", "c"]);
    expect(shares.map((s) => s.amount)).toEqual([1667, 1667, 1666]);
  });

  it("splits evenly when it divides", () => {
    const shares = splitFine(6000, ["a", "b", "c"]);
    expect(shares.map((s) => s.amount)).toEqual([2000, 2000, 2000]);
  });

  it("gives the whole fine to a single recipient", () => {
    expect(splitFine(5000, ["a"])).toEqual([{ toUserId: "a", amount: 5000 }]);
  });

  it("always sums exactly to the fine", () => {
    for (const amount of [1, 2, 3, 49, 5000, 99999]) {
      for (const n of [1, 2, 3, 4, 7]) {
        const ids = Array.from({ length: n }, (_, i) => `u${i}`);
        const total = splitFine(amount, ids).reduce((t, s) => t + s.amount, 0);
        expect(total).toBe(amount);
      }
    }
  });

  it("rejects non-integer, zero, negative amounts and empty recipients", () => {
    expect(() => splitFine(50.5, ["a"])).toThrow();
    expect(() => splitFine(0, ["a"])).toThrow();
    expect(() => splitFine(-100, ["a"])).toThrow();
    expect(() => splitFine(100, [])).toThrow();
    expect(() => splitFine(100, ["a", "a"])).toThrow();
  });
});

describe("money formatting", () => {
  it("reads the exponent from the currency, not a hardcoded /100", () => {
    expect(minorUnitExponent("INR")).toBe(2);
    expect(minorUnitExponent("JPY")).toBe(0);
    expect(minorUnitExponent("KWD")).toBe(3);
  });

  it("formats minor units as the currency string", () => {
    // Non-breaking spaces and symbol placement vary by ICU; assert the digits.
    expect(formatMoney(5000, "INR")).toContain("50.00");
    expect(formatMoney(5000, "JPY").replace(/\D/g, "")).toBe("5000");
  });
});
