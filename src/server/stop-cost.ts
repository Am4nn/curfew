import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db";
import { evidence, groupMembers, groups } from "@/db/schema";
import type { StopCost } from "@/domain";
import { acceptedTypes, sharesFor } from "./sharing";
import { standingFor } from "./standing";
import { timezoneHistory } from "./config";
import { now } from "@/lib/clock";

// What pressing Stop tracking actually costs, worked out before it is pressed.
//
// The screen offered a bare <form action> with no confirmation at all, on a
// press with four separate consequences, one of them permanent: the
// photographs a group has seen go when sharing stops, and sharing the type
// again later does not bring them back. Item 22.
//
// It reads, it never writes, and it is not a source of truth for any of this:
// `stopTracking` in activities.ts is what actually happens, and it works the
// same whether or not anybody read this first. Everything here is a count of
// what is true at the moment the sheet opens.
//
// The SENTENCES are `domain/stop-cost.ts`, which has no database and so can be
// tested without one. This file is only the counting.

export async function stopTrackingCost(
  userId: string,
  typeKey: string,
): Promise<StopCost> {
  const at = await now();
  const standing = await standingFor(userId, typeKey);

  const memberships = await db
    .select({
      groupId: groupMembers.groupId,
      name: groups.name,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)))
    .orderBy(groups.name);

  const shown: string[] = [];
  const photoGroups: string[] = [];
  const ceilingDrops: string[] = [];
  let evidenceSince: Date | null = null;

  for (const m of memberships) {
    const mine = (await sharesFor(m.groupId, userId)).find((s) => s.typeKey === typeKey);
    if (!mine?.shared) continue;
    shown.push(m.name);

    // Breadth is a fraction of what the group accepts, so a type it does not
    // accept was never in the numerator and cannot leave it.
    const accepted = await acceptedTypes(m.groupId, at);
    if (accepted.some((a) => a.typeKey === typeKey)) ceilingDrops.push(m.name);

    // Evidence is one count across every group, because it is one set of
    // photographs. The earliest join date is the widest window any of them
    // has, and a photograph visible to the group that joined first is the
    // photograph that leaves.
    if (mine.shareEvidence) {
      photoGroups.push(m.name);
      const zone = (await timezoneHistory(userId)).at(at);
      const from = DateTime.fromISO(m.joinedAt, { zone }).startOf("day").toJSDate();
      if (!evidenceSince || from < evidenceSince) evidenceSince = from;
    }
  }

  let photos = 0;
  if (evidenceSince) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(evidence)
      .where(
        and(
          eq(evidence.userId, userId),
          eq(evidence.typeKey, typeKey),
          isNotNull(evidence.confirmedAt),
          isNull(evidence.deletedAt),
          gte(evidence.confirmedAt, evidenceSince),
        ),
      );
    photos = row?.n ?? 0;
  }

  return {
    streak: standing?.streak ?? 0,
    groups: shown,
    photoGroups,
    photos,
    ceilingDrops,
  };
}
