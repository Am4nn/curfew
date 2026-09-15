import { describe, it, expect } from "vitest";
import {
  GRACE_PER_ACTIVITY,
  OFFER_MAX_DAYS,
  gracePool,
  graceBalance,
  offerOpen,
  daysBetween,
  resetsOn,
} from "./grace";

describe("the pool", () => {
  it("is two a month for each activity tracked", () => {
    expect(GRACE_PER_ACTIVITY).toBe(2);
    expect(gracePool(1)).toBe(2);
    expect(gracePool(6)).toBe(12);
  });

  it("is nothing at all for somebody tracking nothing", () => {
    // Which is right: there is no streak to hold either.
    expect(gracePool(0)).toBe(0);
  });

  it("never goes below zero, whatever the events say", () => {
    // The pool shrinks when an activity is dropped, so somebody can be over
    // their allowance without having done anything wrong. The screen says zero
    // left rather than a negative number, and the offers say what they need.
    expect(graceBalance(2, 6)).toEqual({ pool: 4, spent: 6, left: 0 });
  });

  it("is the whole month's allowance, not a remainder", () => {
    expect(graceBalance(4, 3)).toEqual({ pool: 8, spent: 3, left: 5 });
  });
});

describe("how long an offer stays open", () => {
  it("is open the day the streak breaks, checked in or not", () => {
    // The floor. Somebody who checks in the next morning still gets to meet the
    // offer they would otherwise never have seen.
    expect(offerOpen("2026-09-10", "2026-09-10", true)).toBe(true);
  });

  it("closes once the activity has been checked in again", () => {
    expect(offerOpen("2026-09-10", "2026-09-12", true)).toBe(false);
    expect(offerOpen("2026-09-10", "2026-09-12", false)).toBe(true);
  });

  it("closes after a fortnight whatever else is true", () => {
    expect(offerOpen("2026-09-10", "2026-09-24", false)).toBe(true);
    expect(offerOpen("2026-09-10", "2026-09-25", false)).toBe(false);
    expect(OFFER_MAX_DAYS).toBe(14);
  });
});

describe("dates", () => {
  it("counts whole days across a month end", () => {
    expect(daysBetween("2026-09-28", "2026-10-02")).toBe(4);
    expect(daysBetween("2026-09-10", "2026-09-10")).toBe(0);
  });

  it("says when the allowance starts again", () => {
    expect(resetsOn("2026-09")).toBe("2026-10-01");
    expect(resetsOn("2026-12")).toBe("2027-01-01");
  });
});
