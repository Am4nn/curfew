import { cache } from "react";
import { DateTime } from "luxon";
import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers } from "@/db/schema";
import { resolveUserTimezone } from "./config";
import { now } from "@/lib/clock";

// The join grace period: a group does not count the day you joined.
//
// Somebody who accepts an invite at nine in the evening has already lived that
// day. Judging it would fine them for a window that shut before they had heard
// of the group, and dock a reputation they had not started earning. So the
// group starts counting them the next day, and says so to everyone.
//
// It is a GROUP boundary and nothing more. The member's own streaks and their
// own record run all day exactly as they would have, because those were never
// the group's to judge (decision: a group only ever sees what a member shares
// with it, and only from when it started counting them).
//
// Once, on the join. Rejoining a group you left does not hand out another,
// which falls out of the model rather than needing a rule: the grace is the
// join date, and a rejoin sets a new one only because it IS a new join.

/**
 * The first day a group counts a member: the day after they joined.
 *
 * The engine's boundary, and the only place the +1 is written down.
 */
export function countsFrom(joinedAt: string): string {
  return DateTime.fromISO(joinedAt, { zone: "utc" })
    .plus({ days: 1 })
    .toFormat("yyyy-MM-dd");
}

export interface GracePeriod {
  groupId: string;
  userId: string;
  /** The day they joined, which is the last day this group does not count. */
  joinedAt: string;
  /** The first day this group counts them. */
  countsFrom: string;
  /** Whole hours until then, never below 1 while the grace is still running. */
  hoursLeft: number;
}

/**
 * The grace still running for a member, or null once their join day has ended.
 *
 * The day ends at midnight in the MEMBER's own zone, not the viewer's and not
 * UTC, because that is the boundary every other day of theirs is judged on.
 */
function graceFor(
  groupId: string,
  userId: string,
  joinedAt: string,
  timezone: string,
  instant: Date,
): GracePeriod | null {
  const endsAt = DateTime.fromISO(joinedAt, { zone: timezone }).endOf("day");
  const ms = endsAt.toMillis() - instant.getTime();
  if (ms <= 0) return null;
  return {
    groupId,
    userId,
    joinedAt,
    countsFrom: countsFrom(joinedAt),
    hoursLeft: Math.max(1, Math.ceil(ms / 3_600_000)),
  };
}

/**
 * Membership rows whose join day could still be running somewhere on earth.
 *
 * Zones run from UTC-12 to UTC+14, so a grace still running now was joined on
 * the UTC date or the one before it. Two days back is that with a day to
 * spare, and `graceFor` decides exactly. Narrowing here keeps the timezone
 * lookup off every member of every group: on an ordinary day this comes back
 * empty and nothing else runs at all.
 */
function windowStart(instant: Date): string {
  return DateTime.fromJSDate(instant, { zone: "utc" })
    .minus({ days: 2 })
    .toFormat("yyyy-MM-dd");
}

/** The groups this user is inside the grace period of, keyed by group. */
export const gracesFor = cache(
  async (userId: string): Promise<Map<string, GracePeriod>> => {
    const instant = await now();
    const rows = await db
      .select({ groupId: groupMembers.groupId, joinedAt: groupMembers.joinedAt })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.userId, userId),
          isNull(groupMembers.leftAt),
          gte(groupMembers.joinedAt, windowStart(instant)),
        ),
      );

    const out = new Map<string, GracePeriod>();
    if (rows.length === 0) return out;

    const timezone = await resolveUserTimezone(
      userId,
      instant.toISOString().slice(0, 10),
    );
    for (const r of rows) {
      const grace = graceFor(r.groupId, userId, r.joinedAt, timezone, instant);
      if (grace) out.set(r.groupId, grace);
    }
    return out;
  },
);

/**
 * Everyone in one group whose grace is still running, keyed by user.
 *
 * Every member of the group can see this, deliberately: a group that cannot see
 * why somebody is missing from its numbers reads them as a member who is being
 * let off.
 */
export const gracesIn = cache(
  async (groupId: string): Promise<Map<string, GracePeriod>> => {
    const instant = await now();
    const rows = await db
      .select({ userId: groupMembers.userId, joinedAt: groupMembers.joinedAt })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          isNull(groupMembers.leftAt),
          gte(groupMembers.joinedAt, windowStart(instant)),
        ),
      );

    const out = new Map<string, GracePeriod>();
    for (const r of rows) {
      // Each member's own zone: two people joining the same group an hour apart
      // in Kolkata and London are counted from two different instants.
      const timezone = await resolveUserTimezone(
        r.userId,
        instant.toISOString().slice(0, 10),
      );
      const grace = graceFor(groupId, r.userId, r.joinedAt, timezone, instant);
      if (grace) out.set(r.userId, grace);
    }
    return out;
  },
);
