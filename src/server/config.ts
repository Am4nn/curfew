import { cache } from "react";
import { DateTime } from "luxon";
import { eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { resolveConfig } from "@/domain";
import { now } from "@/lib/clock";

// A `moduleConfigOf` lived here, detecting which of the two shapes a stored
// config row is in. Only the sleep resolver below used it, and that is gone;
// `listUserActivities` has its own unwrap and is what everything else reads
// activity config through.

/** Where everybody starts, and what the seed writes as the NULL default row. */
const DEFAULT_ZONE = "Asia/Kolkata";

/**
 * A member's whole zone history, as two lookups.
 *
 * Read ONCE and asked per day, rather than queried per day. The zone is
 * effective-dated like every other piece of config (invariant 4), so which zone
 * a period was judged in is a question about that period, not about now
 * (invariant 5). `recomputeUser` resolved it once for today and replayed every
 * past period in it, which meant moving country re-judged history: nights
 * already scored in Kolkata were re-read against a Lisbon clock and the
 * verdicts changed under people.
 */
export interface ZoneHistory {
  /** The zone in force on a stored day, "yyyy-MM-dd". */
  on(day: string): string;
  /** The zone in force at an instant. See the note on the circularity. */
  at(instant: Date): string;
}

interface ZoneRow {
  scopeId: string | null;
  effectiveFrom: string;
  timezone: string;
}

/** resolveConfig's ordering: a member's own row first, then the latest. */
function latest(rows: ZoneRow[]): string {
  if (rows.length === 0) return DEFAULT_ZONE;
  return [...rows].sort((a, b) => {
    const aDefault = a.scopeId === null;
    const bDefault = b.scopeId === null;
    if (aDefault !== bDefault) return aDefault ? 1 : -1;
    if (a.effectiveFrom !== b.effectiveFrom) {
      return a.effectiveFrom < b.effectiveFrom ? 1 : -1;
    }
    return 0;
  })[0].timezone;
}

export const timezoneHistory = cache(async function timezoneHistory(
  userId: string,
): Promise<ZoneHistory> {
  const rows: ZoneRow[] = await db
    .select({
      scopeId: userSettings.userId,
      effectiveFrom: userSettings.effectiveFrom,
      timezone: userSettings.timezone,
    })
    .from(userSettings)
    .where(or(eq(userSettings.userId, userId), isNull(userSettings.userId)));

  return {
    on: (day: string) => resolveConfig(rows, day)?.timezone ?? DEFAULT_ZONE,

    // An instant cannot be turned into a date first, because the date it
    // becomes depends on the zone, which is the thing being resolved. Reading
    // the UTC date instead loses up to a day at either end, and the case that
    // matters is not hypothetical: the consent gate dates a member's first zone
    // from their own today, which east of Greenwich is a date UTC has not
    // reached, so the row was invisible and Curfew went on judging them in the
    // seeded default until midnight in London.
    //
    // Each row is therefore tested in ITS OWN zone: it applies once the
    // member's date, read in the zone that row declares, has reached the day
    // the row is effective from. Offsets span 26 hours, so at most two
    // consecutive rows can both apply, and the later one wins as always.
    at: (instant: Date) => {
      const applicable = rows.filter((r) => {
        const local = DateTime.fromJSDate(instant, { zone: r.timezone });
        const day = local.isValid
          ? local.toFormat("yyyy-MM-dd")
          : instant.toISOString().slice(0, 10);
        return r.effectiveFrom <= day;
      });
      return latest(applicable);
    },
  };
});

// Resolve a user's timezone as it stood on `asOf` (a "yyyy-MM-dd" date). Reads
// the user's own rows and the NULL default, then picks with the effective-dated
// rule. Falls back to Asia/Kolkata, which is also the seeded default.
export async function resolveUserTimezone(
  userId: string,
  asOf: string,
): Promise<string> {
  return (await timezoneHistory(userId)).on(asOf);
}

/**
 * What day it is for this user, on the server's clock (invariant 8).
 *
 * Every date a person is judged on is a day in THEIR zone, so anything stored
 * as a date has to be written this way. `new Date().toISOString().slice(0, 10)`
 * is the UTC day, which for anyone east of Greenwich is yesterday for the first
 * hours of their morning: a group joined at 2 AM in Kolkata recorded a join
 * date the joiner had already finished living.
 */
export async function userDay(userId: string): Promise<string> {
  const instant = await now();
  const timezone = (await timezoneHistory(userId)).at(instant);
  return DateTime.fromJSDate(instant, { zone: timezone }).toFormat("yyyy-MM-dd");
}

// `resolveUserSleepConfigRow` stood here: the only place in the app that read
// one named type's config out of this table. Its callers were the personal
// settings screen's SLEEP WINDOWS block and the writer behind it, both removed,
// because sleep's windows belong on sleep's own configure screen like every
// other type's.
//
// It is not missed and should not come back. It read a column with two valid
// shapes and parsed the wrong one, so /settings threw a ZodError and 500'd
// permanently for anybody who had saved sleep settings once. Everything else
// reads activity config through `listUserActivities`, which unwraps correctly
// and does not need to know which type it is holding (invariant 6).
