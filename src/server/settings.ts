import { DateTime } from "luxon";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  userSettings,
  userActivityConfig,
  groupMembers,
} from "@/db/schema";
import {
  sleepConfigSchema,
  validateSleepWindows,
  type SleepConfig,
} from "@/domain";
import { resolveUserTimezone, resolveUserSleepConfigRow } from "./config";
import { recordEvent } from "./events";
import { nowUTC } from "@/lib/clock";

// Config is insert-only and effective-dated. A change never touches history: it
// takes effect tomorrow, never today (invariant 4). Editing again the same day
// replaces the still-future, not-yet-applied row.
async function tomorrow(): Promise<string> {
  return (await nowUTC()).plus({ days: 1 }).toFormat("yyyy-MM-dd");
}

// The settings editor shows the config as it will stand going forward, i.e. as
// of tomorrow, since every change is effective-dated to tomorrow (invariant 4).
// Resolving as of today would always show the pre-save value and make a just-
// saved change look lost. Scoring and check-in resolve per period separately and
// are unaffected by this.
export async function getPersonalSettings(
  userId: string,
): Promise<{ timezone: string; windows: SleepConfig }> {
  const t = await tomorrow();
  const timezone = await resolveUserTimezone(userId, t);
  const { config } = await resolveUserSleepConfigRow(userId, t);
  return { timezone, windows: config };
}

export async function updateTimezone(userId: string, timezone: string): Promise<void> {
  if (!DateTime.now().setZone(timezone).isValid) {
    throw new Error(`invalid timezone: ${timezone}`);
  }
  await db
    .insert(userSettings)
    .values({ userId, timezone, effectiveFrom: await tomorrow() })
    .onConflictDoUpdate({
      target: [userSettings.userId, userSettings.effectiveFrom],
      set: { timezone },
    });
}

export async function updateSleepWindows(
  userId: string,
  windows: unknown,
): Promise<void> {
  const config = sleepConfigSchema.parse(windows);
  const effectiveFrom = await tomorrow();
  const timezone = await resolveUserTimezone(userId, effectiveFrom);
  const errors = validateSleepWindows(config, timezone, effectiveFrom);
  if (errors.length > 0) throw new Error(errors[0]);
  await db
    .insert(userActivityConfig)
    .values({ userId, typeKey: "sleep", config, effectiveFrom })
    .onConflictDoUpdate({
      target: [
        userActivityConfig.userId,
        userActivityConfig.typeKey,
        userActivityConfig.effectiveFrom,
      ],
      set: { config },
    });
}

