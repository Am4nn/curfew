import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import { userActivities, userActivityConfig, memberShares } from "@/db/schema";
import {
  resolveAt,
  resolveConfig,
  getActivityType,
  scheduleConfigSchema,
  type ScheduleConfig,
} from "@/domain";
import { getAppConfig } from "./app-config";
import { revokeTags } from "./evidence-tags";
import { timezoneHistory } from "./config";
import { now } from "@/lib/clock";

/** A calendar date in a given zone, "yyyy-MM-dd". */
function isoDate(instant: Date, timezone: string): string {
  return DateTime.fromJSDate(instant, { zone: timezone }).toFormat("yyyy-MM-dd");
}

function addDays(date: string, days: number): string {
  return DateTime.fromISO(date, { zone: "utc" }).plus({ days }).toFormat("yyyy-MM-dd");
}

// A user's own activities: whether they track a type, and how they have it set
// up. The two are stored apart on purpose (decision 83).
//
//   user_activities        the ON/OFF switch, immediate, effective_at
//   user_activity_config   the settings, future-dated, effective_from
//
// A future-dated switch-off would score the day you quit as a miss, which is
// the retroactive miss decision 59 forbids. A future-dated settings change is
// exactly what invariant 4 requires, so a change never rewrites a period that
// is already running.

export interface UserActivity {
  typeKey: string;
  enabled: boolean;
  schedule: ScheduleConfig;
  config: unknown;
}

/** The engine-owned half of a config blob, with the module's half beside it. */
function splitConfig(raw: unknown): { schedule: ScheduleConfig; config: unknown } {
  const blob = (raw ?? {}) as Record<string, unknown>;
  return {
    schedule: scheduleConfigSchema.parse(blob.schedule),
    config: blob.config,
  };
}

/**
 * Everything this user tracks right now, enabled or not.
 *
 * Cached per request, because it is asked for far more often than it looks.
 * Home calls it once itself, then `getCheckinState` and `standingFor` each call
 * `getUserActivity` per row, and every one of those calls this again: thirteen
 * times to draw six rows. Nothing writes to these tables and then re-reads them
 * in the same request, so one answer a request is the right answer.
 */
export const listUserActivities = cache(async function listUserActivities(
  userId: string,
): Promise<UserActivity[]> {
  // The app clock, not the process one: a preview scrubbed to another day has
  // to resolve the config that stood on THAT day, or every screen reads today's
  // settings against a scored history that used the day's own.
  const instant = await now();
  // The user's own date, not UTC. At 23:00 in Kolkata the UTC date is still
  // yesterday, and resolving against it would return yesterday's settings.
  //
  // Asked of the INSTANT rather than of a date, because the date to look up is
  // the thing being worked out: reading the UTC one first is what this comment
  // was written to avoid and what the code underneath it used to do.
  const timezone = (await timezoneHistory(userId)).at(instant);
  const today = isoDate(instant, timezone);

  const [switches, configs] = await Promise.all([
    db
      .select({
        id: userActivities.id,
        typeKey: userActivities.typeKey,
        enabled: userActivities.enabled,
        effectiveAt: userActivities.effectiveAt,
      })
      .from(userActivities)
      .where(eq(userActivities.userId, userId)),
    db
      .select({
        scopeId: userActivityConfig.userId,
        typeKey: userActivityConfig.typeKey,
        effectiveFrom: userActivityConfig.effectiveFrom,
        config: userActivityConfig.config,
      })
      .from(userActivityConfig)
      .where(eq(userActivityConfig.userId, userId)),
  ]);

  const keys = new Set(switches.map((s) => s.typeKey));
  const out: UserActivity[] = [];

  for (const typeKey of keys) {
    const row = resolveAt(switches.filter((s) => s.typeKey === typeKey), instant);
    if (!row) continue;

    const configRow = resolveConfig(
      configs.filter((c) => c.typeKey === typeKey),
      today,
    );
    if (!configRow) continue;

    const { schedule, config } = splitConfig(configRow.config);
    out.push({ typeKey, enabled: row.enabled, schedule, config });
  }

  return out;
});

export async function getUserActivity(
  userId: string,
  typeKey: string,
): Promise<UserActivity | null> {
  const all = await listUserActivities(userId);
  return all.find((a) => a.typeKey === typeKey) ?? null;
}

/**
 * What the configure screen shows for a type the user does not track yet: the
 * module's own defaults, prefilled (decision 31).
 */
export function defaultsFor(typeKey: string): UserActivity {
  const type = getActivityType(typeKey);
  return {
    typeKey,
    enabled: false,
    schedule: {
      schedule: type.defaults.schedule,
      dayBoundary: type.defaults.dayBoundary,
      // The module's own number, or none. This was hardcoded to 0 on the
      // grounds that a gap nobody chose is a rule imposed, which read well and
      // meant water shipped with the hole it exists to close: eight glasses in
      // eight seconds passed the day. It is still overridable on the configure
      // screen, so it is a default rather than a rule.
      minGap: type.defaults.minGap ?? 0,
    },
    config: type.defaults.config,
  };
}

/** Types a user may add: registered, with an enabled row, not already tracked. */
export async function catalogFor(userId: string) {
  const [{ enabledTypes }, mine] = await Promise.all([
    getAppConfig(),
    listUserActivities(userId),
  ]);
  const tracked = new Set(mine.filter((a) => a.enabled).map((a) => a.typeKey));
  return enabledTypes.map((key) => ({
    type: getActivityType(key),
    tracked: tracked.has(key),
  }));
}

export interface SaveActivityInput {
  userId: string;
  typeKey: string;
  enabled: boolean;
  schedule: ScheduleConfig;
  config: unknown;
}

/**
 * Save an activity's settings, and its on/off state.
 *
 * A first setup lands today; a later change lands tomorrow, so it cannot
 * rewrite how a period already running is judged (invariant 4). The on/off
 * switch takes effect at once either way (decision 83).
 */
export async function saveUserActivity(input: SaveActivityInput): Promise<void> {
  const type = getActivityType(input.typeKey);
  const schedule = scheduleConfigSchema.parse(input.schedule);
  const config = type.configSchema.parse(input.config);

  // Dates in the USER'S timezone, not UTC. "Tomorrow" at 23:00 in Kolkata is a
  // different date from "tomorrow" in UTC, and picking the wrong one would land
  // a change a day early or a day late.
  const at = await now();
  const timezone = (await timezoneHistory(input.userId)).at(at);
  const today = isoDate(at, timezone);

  // A first setup lands TODAY. Invariant 4 future-dates changes so a period
  // already being judged is not rewritten mid-flight, and for a brand new
  // activity there is no such period: the rule has nothing to protect, and
  // future-dating would mean adding an activity that does nothing until
  // tomorrow.
  const existing = await db
    .select({ version: userActivityConfig.version })
    .from(userActivityConfig)
    .where(
      and(
        eq(userActivityConfig.userId, input.userId),
        eq(userActivityConfig.typeKey, input.typeKey),
      ),
    )
    .limit(1);

  const effectiveFrom = existing.length === 0 ? today : addDays(today, 1);

  await db
    .insert(userActivityConfig)
    .values({
      userId: input.userId,
      typeKey: input.typeKey,
      effectiveFrom,
      config: { schedule, config },
    })
    // Saving twice in one day amends the change that has not taken effect yet
    // rather than failing on the unique index. Still insert-only in the sense
    // that matters: a row whose date has passed can never be rewritten.
    .onConflictDoUpdate({
      target: [
        userActivityConfig.userId,
        userActivityConfig.typeKey,
        userActivityConfig.effectiveFrom,
      ],
      set: { config: { schedule, config } },
    });

  await db.insert(userActivities).values({
    userId: input.userId,
    typeKey: input.typeKey,
    enabled: input.enabled,
    // App clock, not the database's: see the note in saveControls.
    effectiveAt: at,
  });
}

/**
 * Stop tracking. The history is kept and the streak freezes at its last value;
 * restarting resumes from zero (ACTIVITIES.md). Nothing is deleted.
 *
 * It also stops sharing the type with every group that was being shown it.
 * `setShare` refuses to share a type you do not track, so sharing and tracking
 * were meant to move together, and this was the one way they could come apart:
 * share it, then stop tracking it, and the share row stood. A group's breadth
 * counts share rows, so that stale row held a ceiling up on the strength of an
 * activity that could no longer produce a period and so could never be missed.
 * The share was also still on screen, telling the group it would see something
 * it never would.
 *
 * Not in `sharing.ts`, which owns this table, because it imports this file and
 * the pair would be a cycle. Everything that makes the table what it is holds:
 * a new row, never an update, carrying the instant it took effect, so a group's
 * ceiling drops from today and every day already scored is judged against the
 * sharing that stood on it (invariant 5).
 */
export async function stopTracking(userId: string, typeKey: string): Promise<void> {
  const at = await now();

  await db.insert(userActivities).values({
    userId,
    typeKey,
    enabled: false,
    effectiveAt: at,
  });

  // Written second. A crash between the two leaves the type untracked and
  // still shared, which is the state this is fixing and which the next stop
  // press repairs; the other order would leave it shared-off and trackable,
  // and nothing would ever put that right.
  const rows = await db
    .select({
      id: memberShares.id,
      groupId: memberShares.groupId,
      shared: memberShares.shared,
      effectiveAt: memberShares.effectiveAt,
    })
    .from(memberShares)
    .where(and(eq(memberShares.userId, userId), eq(memberShares.typeKey, typeKey)));

  const groupIds = [...new Set(rows.map((r) => r.groupId))];
  const sharing = groupIds.filter((groupId) => {
    const mine = rows.filter((r) => r.groupId === groupId);
    return resolveAt(mine, at)?.shared === true;
  });
  if (sharing.length === 0) return;

  await db.insert(memberShares).values(
    sharing.map((groupId) => ({
      groupId,
      userId,
      typeKey,
      shared: false,
      shareEvidence: false,
      effectiveAt: at,
      changedBy: userId,
    })),
  );

  // And the photographs those groups have seen of it go with the sharing (item
  // 15). This is the consequence the stop sheet calls permanent: tagging is
  // insert-only, so tracking the type again and sharing it again does not
  // bring them back.
  //
  // Written third, after the share rows, for the same reason they were written
  // after the switch: a crash here leaves photographs visible to a group that
  // can no longer be shown anything new, which the next stop press repairs.
  for (const groupId of sharing) {
    await revokeTags(userId, groupId, typeKey, at);
  }
}
