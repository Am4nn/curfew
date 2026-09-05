import { DateTime } from "luxon";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSettings, userActivityConfig } from "@/db/schema";
import {
  sleepConfigSchema,
  validateSleepWindows,
  type SleepConfig,
} from "@/domain";
import { resolveUserTimezone, resolveUserSleepConfigRow } from "./config";
import { now, nowUTC } from "@/lib/clock";

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

/**
 * Has this person ever chosen a zone, or are they still on the app default?
 *
 * A new account has no row at all, so `resolveUserTimezone` falls through to the
 * seeded default. For anybody outside that one zone every window, every deadline
 * and every day boundary is read on somebody else's midnight, silently, until
 * they find the Settings screen.
 */
export async function hasOwnTimezone(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ version: userSettings.version })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return row !== undefined;
}

/**
 * The first zone a person ever has, read off their device and confirmed at the
 * consent gate.
 *
 * Effective from today, where every later change is effective from tomorrow
 * (invariant 4). The reason for that rule is that moving a boundary under a
 * period in progress rewrites how it is judged, and at the gate there is no
 * period: consent is the first thing that happens to an account, before any
 * activity is configured and before anything has been scored. Dating this
 * tomorrow instead would judge their first day in the seeded default, which is
 * the whole thing it exists to prevent.
 *
 * A no-op once they have a row of their own, so it can never overwrite a choice,
 * and false rather than a throw on a zone the runtime does not know: a broken or
 * hostile client must not be able to block somebody from consenting.
 */
export async function setInitialTimezone(
  userId: string,
  timezone: string,
): Promise<boolean> {
  if (!DateTime.now().setZone(timezone).isValid) return false;
  if (await hasOwnTimezone(userId)) return false;
  const effectiveFrom = DateTime.fromJSDate(await now(), { zone: timezone }).toFormat(
    "yyyy-MM-dd",
  );
  await db
    .insert(userSettings)
    .values({ userId, timezone, effectiveFrom })
    .onConflictDoNothing();
  return true;
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

