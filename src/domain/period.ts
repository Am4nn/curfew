import { DateTime } from "luxon";
import type { Period } from "./types";

// The single place the noon-to-noon boundary is computed. Never inline this
// date math elsewhere (see CLAUDE.md conventions).
//
// A "day" period runs local noon to noon: a check-in before local noon belongs
// to the previous day's night, so a 00:30 press attaches to the night that just
// ended, not the one about to begin.
//
// `instant` is either an absolute instant (a Date, or an ISO string carrying an
// offset or Z) or a bare local wall-clock string, which is read in `timezone`.
// This mirrors Luxon's own fromISO behaviour and is what lets the same instant
// resolve to different dates for users in different zones.
export function periodStart(
  instant: Date | string,
  timezone: string,
  period: Period = "day",
): string {
  if (period !== "day") {
    // v1 tracks sleep, which is daily. Weekly/monthly periods arrive with the
    // first non-daily activity type; implementing them now would be untested
    // dead code.
    throw new Error(
      `periodStart: only 'day' is implemented in v1 (got '${period}')`,
    );
  }

  const dt =
    instant instanceof Date
      ? DateTime.fromJSDate(instant, { zone: timezone })
      : DateTime.fromISO(instant, { zone: timezone });

  if (!dt.isValid) {
    throw new Error(
      `periodStart: invalid instant '${String(instant)}' (${dt.invalidReason})`,
    );
  }

  const anchored = dt.hour < 12 ? dt.minus({ days: 1 }) : dt;
  return anchored.toFormat("yyyy-MM-dd");
}
