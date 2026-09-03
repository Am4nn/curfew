import { and, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import { userActivities, userActivityConfig } from "@/db/schema";
import {
  resolveAt,
  resolveConfig,
  getActivityType,
  scheduleConfigSchema,
  type ScheduleConfig,
} from "@/domain";
import { getAppConfig } from "./app-config";
import { resolveUserTimezone } from "./config";

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
export function splitConfig(raw: unknown): { schedule: ScheduleConfig; config: unknown } {
  const blob = (raw ?? {}) as Record<string, unknown>;
  return {
    schedule: scheduleConfigSchema.parse(blob.schedule),
    config: blob.config,
  };
}

/** Everything this user tracks right now, enabled or not. */
export async function listUserActivities(userId: string): Promise<UserActivity[]> {
  const now = new Date();
  // The user's own date, not UTC. At 23:00 in Kolkata the UTC date is still
  // yesterday, and resolving against it would return yesterday's settings.
  const timezone = await resolveUserTimezone(userId, isoDate(now, "utc"));
  const today = isoDate(now, timezone);

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
    const row = resolveAt(switches.filter((s) => s.typeKey === typeKey), now);
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
}

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
      grace: type.defaults.grace,
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
  const timezone = await resolveUserTimezone(input.userId, isoDate(new Date(), "utc"));
  const today = isoDate(new Date(), timezone);

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
    effectiveAt: new Date(),
  });
}

/**
 * Stop tracking. The history is kept and the streak freezes at its last value;
 * restarting resumes from zero (ACTIVITIES.md). Nothing is deleted.
 */
export async function stopTracking(userId: string, typeKey: string): Promise<void> {
  await db.insert(userActivities).values({
    userId,
    typeKey,
    enabled: false,
    effectiveAt: new Date(),
  });
}

/** Whether the user has ever set this type up, for choosing Add against Save. */
export async function hasEverTracked(userId: string, typeKey: string): Promise<boolean> {
  const rows = await db
    .select({ id: userActivities.id })
    .from(userActivities)
    .where(and(eq(userActivities.userId, userId), eq(userActivities.typeKey, typeKey)))
    .limit(1);
  return rows.length > 0;
}
