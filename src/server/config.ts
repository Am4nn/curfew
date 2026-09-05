import { cache } from "react";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { userSettings, userActivityConfig } from "@/db/schema";
import {
  resolveConfig,
  sleepConfigSchema,
  type SleepConfig,
  type FineRules,
} from "@/domain";

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

// Resolve a user's timezone as it stood on `asOf` (a "yyyy-MM-dd" date). Reads
// the user's own rows and the NULL default, then picks with the effective-dated
// rule. Falls back to Asia/Kolkata, which is also the seeded default.
export const resolveUserTimezone = cache(async function resolveUserTimezone(
  userId: string,
  asOf: string,
): Promise<string> {
  const rows = await db
    .select({
      scopeId: userSettings.userId,
      effectiveFrom: userSettings.effectiveFrom,
      timezone: userSettings.timezone,
    })
    .from(userSettings)
    .where(or(eq(userSettings.userId, userId), isNull(userSettings.userId)));

  return resolveConfig(rows, asOf)?.timezone ?? "Asia/Kolkata";
});

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
