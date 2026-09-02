import { describe, it, expect } from "vitest";
import {
  periodUnit,
  isScheduledDay,
  scheduleSchema,
  scheduleConfigSchema,
  EVERY_DAY,
  WEEKDAYS,
} from "./schedule";

describe("period unit is derived from the schedule", () => {
  it("named days are judged by the day", () => {
    expect(periodUnit(EVERY_DAY)).toBe("day");
    expect(periodUnit(WEEKDAYS)).toBe("day");
  });

  it("a minimum a week is judged by the week", () => {
    expect(periodUnit({ kind: "minimum", perWeek: 3 })).toBe("week");
  });
});

describe("isScheduledDay", () => {
  it("named days count only themselves", () => {
    expect(isScheduledDay(WEEKDAYS, 1)).toBe(true);
    expect(isScheduledDay(WEEKDAYS, 5)).toBe(true);
    expect(isScheduledDay(WEEKDAYS, 6)).toBe(false);
    expect(isScheduledDay(WEEKDAYS, 7)).toBe(false);
  });

  it("a minimum a week has no unscheduled days", () => {
    const any3 = { kind: "minimum", perWeek: 3 } as const;
    for (const d of [1, 2, 3, 4, 5, 6, 7] as const) {
      expect(isScheduledDay(any3, d)).toBe(true);
    }
  });
});

describe("the schema refuses shapes nobody means", () => {
  it("cannot express named days and a minimum at once", () => {
    // One control, two modes (decision 55). "Mondays, at least 3 a week" is not
    // a rule anyone sets, so it must not be representable.
    expect(() =>
      scheduleSchema.parse({ kind: "days", days: [1], perWeek: 3 }),
    ).not.toThrow(); // extra keys are stripped, not merged into a second mode
    const parsed = scheduleSchema.parse({ kind: "days", days: [1], perWeek: 3 });
    expect("perWeek" in parsed).toBe(false);
  });

  it("rejects an empty day list", () => {
    expect(() => scheduleSchema.parse({ kind: "days", days: [] })).toThrow();
  });

  it("rejects a weekday outside one to seven", () => {
    expect(() => scheduleSchema.parse({ kind: "days", days: [0] })).toThrow();
    expect(() => scheduleSchema.parse({ kind: "days", days: [8] })).toThrow();
  });

  it("rejects a minimum above seven, which no week can meet", () => {
    expect(() => scheduleSchema.parse({ kind: "minimum", perWeek: 8 })).toThrow();
  });

  it("accepts a whole engine-owned config", () => {
    const parsed = scheduleConfigSchema.parse({
      schedule: { kind: "minimum", perWeek: 3 },
      dayBoundary: "midnight",
      grace: 2,
    });
    expect(parsed.grace).toBe(2);
  });

  it("rejects a negative grace", () => {
    expect(() =>
      scheduleConfigSchema.parse({
        schedule: EVERY_DAY,
        dayBoundary: "midnight",
        grace: -1,
      }),
    ).toThrow();
  });
});
