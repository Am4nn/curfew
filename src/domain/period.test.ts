import { describe, it, expect } from "vitest";
import {
  periodStart,
  daysInPeriod,
  weekdayOf,
  graceMonth,
  type PeriodSpec,
} from "./period";

const IST = "Asia/Kolkata";
const LONDON = "Europe/London";

const NIGHTLY: PeriodSpec = { unit: "day", boundary: "noon" };
const DAILY: PeriodSpec = { unit: "day", boundary: "midnight" };
const WEEKLY: PeriodSpec = { unit: "week", boundary: "midnight" };

describe("periodStart, daily noon-to-noon", () => {
  it("an evening check-in belongs to that day", () => {
    expect(periodStart("2026-08-31T23:30", IST, NIGHTLY)).toBe("2026-08-31");
  });

  it("a 00:30 check-in belongs to the night that just ended", () => {
    // The one that breaks a naive implementation.
    expect(periodStart("2026-09-01T00:30", IST, NIGHTLY)).toBe("2026-08-31");
  });

  it("an afternoon check-in belongs to the new day", () => {
    expect(periodStart("2026-09-01T13:00", IST, NIGHTLY)).toBe("2026-09-01");
  });

  describe("previous-day rollover across month ends", () => {
    it("31-day month (Aug 1 00:30 -> Jul 31)", () => {
      expect(periodStart("2026-08-01T00:30", IST, NIGHTLY)).toBe("2026-07-31");
    });
    it("30-day month (Jul 1 00:30 -> Jun 30)", () => {
      expect(periodStart("2026-07-01T00:30", IST, NIGHTLY)).toBe("2026-06-30");
    });
    it("leap February (Mar 1 00:30 2028 -> Feb 29)", () => {
      expect(periodStart("2028-03-01T00:30", IST, NIGHTLY)).toBe("2028-02-29");
    });
  });

  it("the same instant can resolve to different dates per timezone", () => {
    // 07:00 UTC is 12:30 IST (>= noon -> that day) but 08:00 London
    // (< noon -> the previous day).
    const instant = new Date("2026-08-31T07:00:00Z");
    expect(periodStart(instant, IST, NIGHTLY)).toBe("2026-08-31");
    expect(periodStart(instant, LONDON, NIGHTLY)).toBe("2026-08-30");
  });

  it("rejects an invalid instant", () => {
    expect(() => periodStart("not-a-date", IST, NIGHTLY)).toThrow();
  });
});

describe("periodStart, daily midnight boundary", () => {
  it("a 00:30 check-in belongs to the new day, unlike sleep", () => {
    expect(periodStart("2026-09-01T00:30", IST, DAILY)).toBe("2026-09-01");
  });

  it("an evening check-in belongs to that day", () => {
    expect(periodStart("2026-09-01T23:30", IST, DAILY)).toBe("2026-09-01");
  });

  it("noon is not special", () => {
    expect(periodStart("2026-09-01T11:59", IST, DAILY)).toBe("2026-09-01");
    expect(periodStart("2026-09-01T12:01", IST, DAILY)).toBe("2026-09-01");
  });
});

describe("periodStart, weekly", () => {
  // 2026-09-03 is a Thursday.
  it("every day of a week resolves to its Monday", () => {
    for (const [date, weekday] of [
      ["2026-08-31", "Mon"], ["2026-09-01", "Tue"], ["2026-09-02", "Wed"],
      ["2026-09-03", "Thu"], ["2026-09-04", "Fri"], ["2026-09-05", "Sat"],
      ["2026-09-06", "Sun"],
    ] as const) {
      expect(periodStart(`${date}T13:00`, IST, WEEKLY), weekday).toBe("2026-08-31");
    }
  });

  it("Monday starts a new week, Sunday closes the old one", () => {
    expect(periodStart("2026-09-06T23:59", IST, WEEKLY)).toBe("2026-08-31");
    expect(periodStart("2026-09-07T00:01", IST, WEEKLY)).toBe("2026-09-07");
  });

  it("a noon boundary moves the week's edge to Monday noon", () => {
    const spec: PeriodSpec = { unit: "week", boundary: "noon" };
    // Monday 09:00 is still the previous activity-day, a Sunday, so it belongs
    // to the week that is closing.
    expect(periodStart("2026-09-07T09:00", IST, spec)).toBe("2026-08-31");
    expect(periodStart("2026-09-07T13:00", IST, spec)).toBe("2026-09-07");
  });

  it("a week spanning a month end keeps its Monday", () => {
    expect(periodStart("2026-10-02T13:00", IST, WEEKLY)).toBe("2026-09-28");
  });
});

describe("daysInPeriod", () => {
  it("a daily period is one day", () => {
    expect(daysInPeriod("2026-09-03", "day")).toEqual(["2026-09-03"]);
  });

  it("a weekly period is Monday to Sunday", () => {
    expect(daysInPeriod("2026-08-31", "week")).toEqual([
      "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03",
      "2026-09-04", "2026-09-05", "2026-09-06",
    ]);
  });

  it("rejects an invalid date", () => {
    expect(() => daysInPeriod("nope", "day")).toThrow();
  });
});

describe("weekdayOf", () => {
  it("numbers Monday 1 through Sunday 7", () => {
    expect(weekdayOf("2026-08-31")).toBe(1);
    expect(weekdayOf("2026-09-04")).toBe(5);
    expect(weekdayOf("2026-09-06")).toBe(7);
  });
});

describe("graceMonth", () => {
  it("is the month of the period start", () => {
    expect(graceMonth("2026-09-03")).toBe("2026-09");
  });

  it("a week straddling a month end charges the month of its Monday", () => {
    // Mon 28 Sep to Sun 4 Oct spends September's grace, not October's.
    expect(graceMonth("2026-09-28")).toBe("2026-09");
  });
});
