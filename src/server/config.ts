import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { userSettings, userActivityConfig, activityRules } from "@/db/schema";
import {
  resolveConfig,
  sleepConfigSchema,
  type SleepConfig,
  type FineRules,
} from "@/domain";

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
  return { config: sleepConfigSchema.parse(row.config), version: row.version };
}

export async function resolveUserSleepConfig(
  userId: string,
  periodStart: string,
): Promise<SleepConfig> {
  return (await resolveUserSleepConfigRow(userId, periodStart)).config;
}

export interface ResolvedRules extends FineRules {
  version: number;
  currency: string;
  gracePerMonth: number;
}

// Resolve an activity's fine policy as it stood on the period. Mirrors the
// effective-dated SQL: the activity's own row beats the null default, latest
// effective_from that is still <= the period wins.
export async function resolveActivityRules(
  activityId: string,
  periodStart: string,
): Promise<ResolvedRules> {
  const rows = await db
    .select({
      scopeId: activityRules.activityId,
      effectiveFrom: activityRules.effectiveFrom,
      version: activityRules.version,
      fineMode: activityRules.fineMode,
      fineAmount: activityRules.fineAmount,
      fineStep: activityRules.fineStep,
      fineCap: activityRules.fineCap,
      currency: activityRules.currency,
      gracePerMonth: activityRules.gracePerMonth,
    })
    .from(activityRules)
    .where(
      or(eq(activityRules.activityId, activityId), isNull(activityRules.activityId)),
    );

  const row = resolveConfig(rows, periodStart);
  if (!row) {
    throw new Error(`no activity rules effective on ${periodStart}`);
  }
  return {
    version: row.version,
    fineMode: row.fineMode === "escalating" ? "escalating" : "flat",
    fineAmount: row.fineAmount,
    fineStep: row.fineStep,
    fineCap: row.fineCap,
    currency: row.currency,
    gracePerMonth: row.gracePerMonth,
  };
}
