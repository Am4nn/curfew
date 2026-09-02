import { and, eq, isNull, lt, notExists, sql } from "drizzle-orm";
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

/** Everything this user still has to acknowledge, oldest first. */
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
    .orderBy(notices.createdAt);
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
export async function publishNotice(body: string, adminId: string): Promise<string> {
  const [row] = await db
    .insert(notices)
    .values({ body, createdBy: adminId })
    .returning({ id: notices.id });
  return row.id;
}

/**
 * Retire a notice that has served its purpose. Acknowledgements are kept: they
 * are a record of who saw it, not a to-do list.
 */
export async function retireNotice(noticeId: string): Promise<void> {
  await db
    .update(notices)
    .set({ retiredAt: new Date() })
    .where(and(eq(notices.id, noticeId), isNull(notices.retiredAt)));
}
