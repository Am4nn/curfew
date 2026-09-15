import { DateTime } from "luxon";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { resolveUserTimezone, userDay } from "./config";
import { dayAfter } from "@/lib/day-format";
import { now } from "@/lib/clock";

// Config is insert-only and effective-dated. A change never touches history: it
// takes effect tomorrow, never today (invariant 4). Editing again the same day
// replaces the still-future, not-yet-applied row.
//
// THE MEMBER'S TOMORROW, not the UTC one. This read `nowUTC()` plus a day, and
// every date it is compared against is a day in the member's own zone. For
// anyone far enough east, a change saved late in their evening was dated to a
// day they were already living, so it took effect at once and rewrote a period
// in progress, which is the one thing invariant 4 exists to stop. For anyone
// far enough west it landed two of their days out and did nothing tomorrow.
async function tomorrow(userId: string): Promise<string> {
  return dayAfter(await userDay(userId));
}

// The settings editor shows the config as it will stand going forward, i.e. as
// of tomorrow, since every change is effective-dated to tomorrow (invariant 4).
// Resolving as of today would always show the pre-save value and make a just-
// saved change look lost. Scoring and check-in resolve per period separately and
// are unaffected by this.
// `windows` came back from here too, and reading them is what made this throw:
// the stored column has two valid shapes and parsing the wrong one 500'd
// /settings permanently for anyone who had saved sleep settings once. Nothing
// asks this for sleep any more, so the fragile read is gone rather than fixed
// again. The timezone belongs to no module and every activity reads it.
export async function getPersonalSettings(
  userId: string,
): Promise<{ timezone: string }> {
  const t = await tomorrow(userId);
  return { timezone: await resolveUserTimezone(userId, t) };
}

export async function updateTimezone(userId: string, timezone: string): Promise<void> {
  if (!DateTime.now().setZone(timezone).isValid) {
    throw new Error(`invalid timezone: ${timezone}`);
  }
  await db
    .insert(userSettings)
    // Their tomorrow as measured in the zone they are in NOW, not the one they
    // are moving to: the change is dated from the end of the day they are
    // currently living, and that day is the old zone's.
    .values({ userId, timezone, effectiveFrom: await tomorrow(userId) })
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
async function hasOwnTimezone(userId: string): Promise<boolean> {
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

// `currentSchedule` and `updateSleepWindows` stood here: the write half of the
// personal settings screen's SLEEP WINDOWS block, which is gone. Sleep's
// windows are saved through `saveUserActivity` like every other type's, from
// the one configure screen drawn from the module's `fields()`.
//
// Worth keeping the reason. This wrote the module's half as the WHOLE config
// blob, which is not the shape a row has: `splitConfig` reads `.schedule` off
// it. Saving sleep windows here broke Home for that person with a ZodError
// until a save through the configure screen put a wrapped row back. A second
// writer of one thing is how that happens.

