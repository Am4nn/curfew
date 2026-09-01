import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { activityScores, groupMembers } from "@/db/schema";
import { assertMember } from "./membership";
import { runsFrom, type Streak } from "./streak-core";

export type { Streak } from "./streak-core";

// The streak is personal and group-independent: activity_scores is keyed by
// (user, type, period) with no group dimension, so one row per night says
// whether this person met their own sleep windows. No grace is applied here;
// grace lives in the per-group activity_outcomes and never reaches this number
// (that is the money layer, not the personal record).

export async function getPersonalStreak(userId: string): Promise<Streak> {
  const rows = await db
    .select({ periodStart: activityScores.periodStart, passed: activityScores.passed })
    .from(activityScores)
    .where(and(eq(activityScores.userId, userId), eq(activityScores.typeKey, "sleep")))
    .orderBy(activityScores.periodStart);
  return runsFrom(rows.map((r) => r.passed));
}

// Each active member's current personal streak, for the group hub. Membership is
// asserted for the caller; the scores read are already global-per-user, so
// showing a member's streak reveals nothing group-specific beyond their pass run.
export async function groupMemberStreaks(
  groupId: string,
  viewerId: string,
): Promise<Map<string, number>> {
  await assertMember(groupId, viewerId);
  const members = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)));
  const ids = members.map((m) => m.userId);
  const out = new Map<string, number>();
  if (ids.length === 0) return out;

  const rows = await db
    .select({
      userId: activityScores.userId,
      periodStart: activityScores.periodStart,
      passed: activityScores.passed,
    })
    .from(activityScores)
    .where(and(inArray(activityScores.userId, ids), eq(activityScores.typeKey, "sleep")))
    .orderBy(activityScores.periodStart);

  const byUser = new Map<string, boolean[]>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r.passed);
    byUser.set(r.userId, list);
  }
  for (const id of ids) out.set(id, runsFrom(byUser.get(id) ?? []).current);
  return out;
}
