import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { evidence, evidenceGroups, groups } from "@/db/schema";
import { now } from "@/lib/clock";

// Which groups a photograph was sent to (item 15, migration 0024).
//
// The old answer was computed on every read from the CURRENT share state: this
// member shares Gym with this group today, so every photograph they have ever
// taken of Gym is in the feed. Turn sharing on and last week appears. Join a
// group and turn sharing on, and a year of photographs reaches people who were
// not there for any of it.
//
// The new answer is written once, at the check-in that sends the photograph, to
// the groups sharing that activity at that moment. Nothing recomputes it. A
// group added to your sharing tomorrow gets tomorrow's photographs and never
// this one, and no screen has to be careful about it.
//
// Un-sharing REVOKES rather than deletes, so what a group could see and when
// stays answerable, and tagging is insert-only, so re-sharing cannot bring a
// revoked photograph back.

/**
 * Tag one photograph with the groups it is being sent to.
 *
 * WHICH groups is `groupsSeeingEvidence` in sharing.ts, not here: this file is
 * the table and sharing.ts owns the toggles, and the two would otherwise
 * import each other.
 *
 * Called from the check-in that confirms it, after the event. Not atomic with
 * the event, and it cannot be: this codebase has no transactions (see
 * `src/db/index.ts`). The failure falls the right way. A crash here leaves a
 * photograph tagged to nobody, which is a photograph no group sees, and the
 * fix is to take another one. The other order would leave a group looking at a
 * photograph whose check-in was never recorded.
 */
export async function tagEvidence(
  evidenceId: number,
  groupIds: string[],
  at: Date,
): Promise<void> {
  if (groupIds.length === 0) return;
  await db
    .insert(evidenceGroups)
    .values(groupIds.map((groupId) => ({ evidenceId, groupId, taggedAt: at })))
    // The row wins over the write. A tag that is already there, revoked or
    // not, stays exactly as it is, which is what makes revoking final.
    .onConflictDoNothing();
}

/**
 * Stop a group seeing photographs it has already been shown.
 *
 * `typeKey` null revokes every type, which is what leaving a group means.
 * Revoking is an UPDATE and the only one this table ever takes: the row is the
 * record that the group could see it, and that does not stop being true.
 */
export async function revokeTags(
  userId: string,
  groupId: string,
  typeKey: string | null,
  at?: Date,
): Promise<void> {
  const instant = at ?? (await now());

  const mine = db
    .select({ id: evidence.id })
    .from(evidence)
    .where(
      typeKey === null
        ? eq(evidence.userId, userId)
        : and(eq(evidence.userId, userId), eq(evidence.typeKey, typeKey)),
    );

  await db
    .update(evidenceGroups)
    .set({ revokedAt: instant })
    .where(
      and(
        eq(evidenceGroups.groupId, groupId),
        isNull(evidenceGroups.revokedAt),
        inArray(evidenceGroups.evidenceId, mine),
      ),
    );
}

export interface PhotoTag {
  groupId: string;
  name: string;
  /** Saw it once and no longer can. Struck through on Your Photos. */
  revoked: boolean;
}

/**
 * Where each of these photographs went, for Your Photos.
 *
 * One query for the whole page rather than one a row. A photograph with no
 * tags is yours only, and that is the common case, so the map is sparse on
 * purpose: the caller reads a missing key as an empty list.
 */
export async function tagsFor(
  evidenceIds: number[],
): Promise<Map<number, PhotoTag[]>> {
  const out = new Map<number, PhotoTag[]>();
  if (evidenceIds.length === 0) return out;

  const rows = await db
    .select({
      evidenceId: evidenceGroups.evidenceId,
      groupId: evidenceGroups.groupId,
      name: groups.name,
      revokedAt: evidenceGroups.revokedAt,
    })
    .from(evidenceGroups)
    .innerJoin(groups, eq(groups.id, evidenceGroups.groupId))
    .where(inArray(evidenceGroups.evidenceId, evidenceIds))
    // Live first, then by name, so a row reads as where it is now followed by
    // where it used to be.
    .orderBy(sql`${evidenceGroups.revokedAt} nulls first`, groups.name);

  for (const r of rows) {
    const list = out.get(r.evidenceId) ?? [];
    list.push({ groupId: r.groupId, name: r.name, revoked: r.revokedAt !== null });
    out.set(r.evidenceId, list);
  }
  return out;
}
