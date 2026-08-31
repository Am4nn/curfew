import { describe, it, expect } from "vitest";
import { periodStart } from "./period";

const IST = "Asia/Kolkata";
const LONDON = "Europe/London";

describe("periodStart, daily noon-to-noon", () => {
  it("an evening check-in belongs to that day", () => {
    expect(periodStart("2026-08-31T23:30", IST)).toBe("2026-08-31");
  });

  it("a 00:30 check-in belongs to the night that just ended", () => {
    // The one that breaks a naive implementation.
    expect(periodStart("2026-09-01T00:30", IST)).toBe("2026-08-31");
  });

  it("an afternoon check-in belongs to the new day", () => {
    expect(periodStart("2026-09-01T13:00", IST)).toBe("2026-09-01");
  });

  describe("previous-day rollover across month ends", () => {
    it("31-day month (Aug 1 00:30 -> Jul 31)", () => {
      expect(periodStart("2026-08-01T00:30", IST)).toBe("2026-07-31");
    });
    it("30-day month (Jul 1 00:30 -> Jun 30)", () => {
      expect(periodStart("2026-07-01T00:30", IST)).toBe("2026-06-30");
    });
    it("leap February (Mar 1 00:30 2028 -> Feb 29)", () => {
      expect(periodStart("2028-03-01T00:30", IST)).toBe("2028-02-29");
    });
  });

  it("the same instant can resolve to different dates per timezone", () => {
    // 07:00 UTC is 12:30 IST (>= noon -> that day) but 08:00 London
    // (< noon -> the previous day).
    const instant = new Date("2026-08-31T07:00:00Z");
    expect(periodStart(instant, IST)).toBe("2026-08-31");
    expect(periodStart(instant, LONDON)).toBe("2026-08-30");
  });

  it("rejects an unimplemented period granularity", () => {
    expect(() => periodStart("2026-08-31T23:30", IST, "week")).toThrow();
  });

  it("rejects an invalid instant", () => {
    expect(() => periodStart("not-a-date", IST)).toThrow();
  });
});
