import { DateTime } from "luxon";
import type { DayBoundary, PeriodUnit, Weekday } from "./schedule";

// The single place a period boundary is computed. Never inline this date math
// elsewhere (CLAUDE.md conventions).
//
// v1 hardcoded noon to noon because it only tracked sleep. v3 takes the
// boundary and the unit from the activity, because Sleep needs noon while
// everything else wants midnight, and Gym is judged by the week.
//
// `instant` is either an absolute instant (a Date, or an ISO string carrying an
// offset or Z) or a bare local wall-clock string, which is read in `timezone`.
// That mirrors Luxon's own fromISO behaviour and is what lets one instant
// resolve to different dates for users in different zones.

export interface PeriodSpec {
  unit: PeriodUnit;
  boundary: DayBoundary;
}

function toDateTime(instant: Date | string, timezone: string): DateTime {
  const dt =
    instant instanceof Date
      ? DateTime.fromJSDate(instant, { zone: timezone })
      : DateTime.fromISO(instant, { zone: timezone });

  if (!dt.isValid) {
    throw new Error(
      `periodStart: invalid instant '${String(instant)}' (${dt.invalidReason})`,
    );
  }
  return dt;
}

// The activity-day an instant belongs to, as "yyyy-MM-dd".
//
// With a noon boundary the day runs local noon to noon, so a 00:30 press
// attaches to the night that just ended rather than the one about to begin.
// With a midnight boundary it is simply the calendar date.
function dayOf(dt: DateTime, boundary: DayBoundary): DateTime {
  const anchored = boundary === "noon" && dt.hour < 12 ? dt.minus({ days: 1 }) : dt;
  return anchored.startOf("day");
}

export function periodStart(
  instant: Date | string,
  timezone: string,
  spec: PeriodSpec,
): string {
  const day = dayOf(toDateTime(instant, timezone), spec.boundary);

  if (spec.unit === "day") return day.toFormat("yyyy-MM-dd");

  // A week is Monday to Sunday, anchored on the activity-day rather than the
  // calendar date. For a noon-boundary weekly activity that means the week
  // opens at Monday noon. No launch type does this, but the rule has to be
  // defined or the two settings would contradict each other.
  return day.startOf("week").toFormat("yyyy-MM-dd");
}

// Every activity-day inside a period, in order. A daily period is one day; a
// weekly period is its seven. Streaks are always counted in days (decision 2),
// so scoring a week still has to know which days it contains.
export function daysInPeriod(periodStartDate: string, unit: PeriodUnit): string[] {
  const start = DateTime.fromISO(periodStartDate, { zone: "utc" });
  if (!start.isValid) {
    throw new Error(`daysInPeriod: invalid date '${periodStartDate}'`);
  }
  const count = unit === "week" ? 7 : 1;
  return Array.from({ length: count }, (_, i) =>
    start.plus({ days: i }).toFormat("yyyy-MM-dd"),
  );
}

// The weekday of an activity-day, 1 Monday to 7 Sunday.
export function weekdayOf(date: string): Weekday {
  const dt = DateTime.fromISO(date, { zone: "utc" });
  if (!dt.isValid) throw new Error(`weekdayOf: invalid date '${date}'`);
  return dt.weekday;
}

// The calendar month a period charges its grace to, "yyyy-MM". A week takes the
// month of its Monday, so a week straddling a month boundary spends from one
// pool and not both.
export function graceMonth(periodStartDate: string): string {
  return periodStartDate.slice(0, 7);
}
