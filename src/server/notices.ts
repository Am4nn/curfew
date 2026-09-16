import { and, desc, eq, isNotNull, isNull, lt, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import { notices, noticeAcks, users } from "@/db/schema";

// A notice is a blocking overlay on every route (decision 58). The app does
// nothing until it is acknowledged, and acknowledging is final: there is no
// dismiss, only "Got it", so an ack row is the whole state.
//
// Two rules decide what a person sees:
//
//   - A notice applies only to accounts that existed when it was published
//     (decision 80). Somebody who joins next month never knew the old
//     behaviour, so announcing the change to them is noise.
//
//   - Notices merge PER USER at read time (decision 81). One overlay carries
//     everything that user has not acknowledged, and one press clears all of
//     it. They are never queued and the rows are never merged: a row-level
//     merge is wrong the moment one person has acknowledged a notice and
//     another has not. An admin is therefore never blocked from publishing.

export interface PendingNotice {
  id: string;
  body: string;
  createdAt: Date;
}

/**
 * Everything this user still has to acknowledge, NEWEST FIRST.
 *
 * It was oldest first, which is the order things happened and the wrong order
 * to read them in. Somebody who has been away opens one overlay carrying every
 * release they missed, and what they want first is the one that changes what
 * they do today. The oldest is the one they have already lived without knowing.
 */
export async function pendingNotices(userId: string): Promise<PendingNotice[]> {
  return db
    .select({
      id: notices.id,
      body: notices.body,
      createdAt: notices.createdAt,
    })
    .from(notices)
    .innerJoin(users, eq(users.id, userId))
    .where(
      and(
        isNull(notices.retiredAt),
        // Published before this account existed: decision 80.
        lt(users.createdAt, notices.createdAt),
        notExists(
          db
            .select({ one: sql`1` })
            .from(noticeAcks)
            .where(
              and(
                eq(noticeAcks.noticeId, notices.id),
                eq(noticeAcks.userId, userId),
              ),
            ),
        ),
      ),
    )
    .orderBy(desc(notices.createdAt));
}

/**
 * Acknowledge every notice currently pending for this user. One press clears
 * the whole overlay, which is what makes the merge a merge rather than a queue.
 *
 * Idempotent: a double submit, or a second tab, inserts nothing the second
 * time. Acknowledging is final, so there is no path back.
 */
export async function acknowledgeAll(userId: string): Promise<number> {
  const pending = await pendingNotices(userId);
  if (pending.length === 0) return 0;

  await db
    .insert(noticeAcks)
    .values(pending.map((n) => ({ noticeId: n.id, userId })))
    .onConflictDoNothing();

  return pending.length;
}

/**
 * Publish a notice. Only ever called from the admin save sheet, and only when
 * the "Tell users what changed" checkbox was ticked (decision 57), which is
 * unticked by default.
 */
export async function publishNotice(
  body: string,
  adminId: string,
  /**
   * An identity, for a notice that something can try to publish twice.
   *
   * A controls change passes none: the save happened once. A release note
   * passes "release:3.2.0", and a second run returns null rather than
   * announcing the same thing again to everybody who has already read it.
   */
  key?: string,
): Promise<string | null> {
  const [row] = await db
    .insert(notices)
    .values({ body, createdBy: adminId, key: key ?? null })
    // The `where` here is the INDEX PREDICATE, not a filter on rows. The index
    // this arbitrates on is PARTIAL,
    // `WHERE key IS NOT NULL` (migration 0023), because a controls change
    // passes no key and several of those must coexist. Postgres will not infer
    // a partial index from a bare `ON CONFLICT (key)`: it refuses the statement
    // outright with "no unique or exclusion constraint matching the ON CONFLICT
    // specification", so this did not double-publish, it failed every time.
    //
    // Nothing caught it. `release-notes.test.ts` validates the FILE, the only
    // caller with a key is a script CI never runs, and the admin sheet's path
    // passes no key and so never reaches the arbiter. It was found by running
    // the release for real.
    .onConflictDoNothing({ target: notices.key, where: isNotNull(notices.key) })
    .returning({ id: notices.id });
  return row?.id ?? null;
}
