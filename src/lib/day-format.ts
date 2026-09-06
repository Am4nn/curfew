import { DateTime } from "luxon";

/**
 * "Tue 15 Sep": a stored activity-day, written the way the app says dates.
 *
 * Read in UTC on purpose. The string is already a day in the member's own zone,
 * decided when it was stored, so re-interpreting it in anybody's zone here
 * would shift it: a date is not an instant and must not be treated as one.
 */
export function shortDay(day: string): string {
  return DateTime.fromISO(day, { zone: "utc" }).toFormat("ccc d LLL");
}

/** The day after a stored one, for "back on ...". */
export function dayAfter(day: string): string {
  return DateTime.fromISO(day, { zone: "utc" }).plus({ days: 1 }).toFormat("yyyy-MM-dd");
}

/** Whole days from `from` to `to`, both ends counted. */
export function daysBetween(from: string, to: string): number {
  return (
    DateTime.fromISO(to, { zone: "utc" }).diff(
      DateTime.fromISO(from, { zone: "utc" }),
      "days",
    ).days + 1
  );
}
