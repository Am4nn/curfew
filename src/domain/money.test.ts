import { describe, it, expect } from "vitest";
import { splitFine } from "./money";

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
