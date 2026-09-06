import { cache } from "react";
import { DateTime } from "luxon";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { userSettings, userActivityConfig } from "@/db/schema";
import {
  resolveConfig,
  sleepConfigSchema,
  type SleepConfig,
  } from "@/domain";
import { now } from "@/lib/clock";

// A stored config row is either the module's config directly (the seed's own
// userId-null default, written before saveUserActivity's wrapping existed) or
// { schedule, config } (every real per-user save, see activities.ts's
// splitConfig). Detect which one this is rather than assuming — assuming
// wrapped breaks the seed default (no .schedule key to satisfy
// scheduleConfigSchema), assuming flat breaks the first real save.
function moduleConfigOf(raw: unknown): unknown {
  const blob = raw as Record<string, unknown> | null;
  return blob && typeof blob === "object" && "config" in blob ? blob.config : raw;
}

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

// Resolve a user's sleep windows as they stood on the period being scored. The
// module validates the jsonb; the DB never does (invariant: config shape is the
// module's concern).
export async function resolveUserSleepConfigRow(
  userId: string,
  periodStart: string,
): Promise<{ config: SleepConfig; version: number }> {
  const rows = await db
    .select({
      scopeId: userActivityConfig.userId,
      effectiveFrom: userActivityConfig.effectiveFrom,
      config: userActivityConfig.config,
      version: userActivityConfig.version,
    })
    .from(userActivityConfig)
    .where(
      and(
        eq(userActivityConfig.typeKey, "sleep"),
        or(eq(userActivityConfig.userId, userId), isNull(userActivityConfig.userId)),
      ),
    );

  const row = resolveConfig(rows, periodStart);
  if (!row) {
    throw new Error(`no sleep config effective on ${periodStart}`);
  }
  // This was reading the raw blob directly against sleepConfigSchema, which
  // only matches the seed's legacy flat default row and throws the moment a
  // real per-user save (always wrapped as { schedule, config }) takes over.
  return { config: sleepConfigSchema.parse(moduleConfigOf(row.config)), version: row.version };
}

export async function resolveUserSleepConfig(
  userId: string,
  periodStart: string,
): Promise<SleepConfig> {
  return (await resolveUserSleepConfigRow(userId, periodStart)).config;
}
