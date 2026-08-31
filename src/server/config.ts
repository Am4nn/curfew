import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { userSettings, userActivityConfig } from "@/db/schema";
import { resolveConfig, sleepConfigSchema, type SleepConfig } from "@/domain";

// Resolve a user's timezone as it stood on `asOf` (a "yyyy-MM-dd" date). Reads
// the user's own rows and the NULL default, then picks with the effective-dated
// rule. Falls back to Asia/Kolkata, which is also the seeded default.
export async function resolveUserTimezone(
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
}

// Resolve a user's sleep windows as they stood on the period being scored. The
// module validates the jsonb; the DB never does (invariant: config shape is the
// module's concern).
export async function resolveUserSleepConfig(
  userId: string,
  periodStart: string,
): Promise<SleepConfig> {
  const rows = await db
    .select({
      scopeId: userActivityConfig.userId,
      effectiveFrom: userActivityConfig.effectiveFrom,
      config: userActivityConfig.config,
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
  return sleepConfigSchema.parse(row.config);
}
