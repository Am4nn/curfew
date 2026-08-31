import { DateTime } from "luxon";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  userSettings,
  userActivityConfig,
  activityRules,
  activities,
  groupMembers,
} from "@/db/schema";
import {
  sleepConfigSchema,
  validateSleepWindows,
  type SleepConfig,
} from "@/domain";
import {
  resolveUserTimezone,
  resolveUserSleepConfigRow,
  resolveActivityRules,
  type ResolvedRules,
} from "./config";
import { recordEvent } from "./events";

// Config is insert-only and effective-dated. A change never touches history: it
// takes effect tomorrow, never today (invariant 4). Editing again the same day
// replaces the still-future, not-yet-applied row.
function tomorrow(): string {
  return DateTime.utc().plus({ days: 1 }).toFormat("yyyy-MM-dd");
}
function today(): string {
  return DateTime.utc().toFormat("yyyy-MM-dd");
}

export async function getPersonalSettings(
  userId: string,
): Promise<{ timezone: string; windows: SleepConfig }> {
  const t = today();
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
    .values({ userId, timezone, effectiveFrom: tomorrow() })
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
  const effectiveFrom = tomorrow();
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

// The one sleep activity for a group.
export async function groupSleepActivity(
  groupId: string,
): Promise<{ activityId: string } | null> {
  const [a] = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.groupId, groupId),
        eq(activities.typeKey, "sleep"),
        isNull(activities.archivedAt),
      ),
    );
  return a ? { activityId: a.id } : null;
}

export async function getGroupRules(activityId: string): Promise<ResolvedRules> {
  return resolveActivityRules(activityId, today());
}

async function isOwner(groupId: string, userId: string): Promise<boolean> {
  const [m] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        isNull(groupMembers.leftAt),
      ),
    );
  return m?.role === "owner";
}

// Shared rules change: owner only, effective tomorrow, and it announces itself
// with a config.shared.changed event (personal changes stay silent).
export async function updateGroupRules(
  groupId: string,
  activityId: string,
  byUserId: string,
  input: { fineAmount: number; currency: string; gracePerMonth: number },
): Promise<void> {
  if (!(await isOwner(groupId, byUserId))) {
    throw new Error("only the group owner can change shared rules");
  }
  if (!Number.isInteger(input.fineAmount) || input.fineAmount <= 0) {
    throw new Error("fine amount must be a positive integer in minor units");
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error("currency must be a 3-letter code");
  if (!Number.isInteger(input.gracePerMonth) || input.gracePerMonth < 0) {
    throw new Error("grace must be a non-negative integer");
  }

  const effectiveFrom = tomorrow();
  await db
    .insert(activityRules)
    .values({
      activityId,
      fineMode: "flat",
      fineAmount: input.fineAmount,
      currency: input.currency,
      gracePerMonth: input.gracePerMonth,
      effectiveFrom,
      changedBy: byUserId,
    })
    .onConflictDoUpdate({
      target: [activityRules.activityId, activityRules.effectiveFrom],
      set: {
        fineAmount: input.fineAmount,
        currency: input.currency,
        gracePerMonth: input.gracePerMonth,
        changedBy: byUserId,
      },
    });

  await recordEvent({
    userId: byUserId,
    type: "config.shared.changed",
    payload: {
      group_id: groupId,
      activity_id: activityId,
      effective_from: effectiveFrom,
      fine_amount: input.fineAmount,
      currency: input.currency,
      grace_per_month: input.gracePerMonth,
    },
  });
}
