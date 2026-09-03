import { and, eq, isNull, like, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  sessions,
  accounts,
  events,
  evidence,
  activityScores,
  activityOutcomes,
  reputationDaily,
  userActivities,
  userActivityConfig,
  userSettings,
  memberShares,
  groupMembers,
  ledgerEntries,
} from "@/db/schema";
import { deleteObject } from "./r2";
import { recordEvent } from "./events";

// Deleting your data.
//
// Two rules pull against each other and both hold. `ledger_entries` is
// append-only and money owed is retained (invariant 3, decision 17). `events`
// is the only source of truth and everything rebuilds from it (invariant 1).
//
// The resolution TRUST-SAFETY.md left open, settled here: **event rows are kept
// but detached from the person and stripped of anything identifying**. Their
// history stops existing as theirs, aggregate counts survive, and nothing that
// rebuilds from events breaks. Photographs, personal fields and every derived
// row go outright.
//
// A user row is never hard-deleted, because ledger rows point at it and a debt
// with no counterparty is not a debt. It is scrubbed instead, which is what
// "anonymised where possible" means in practice.

export interface DeletionSummary {
  photos: number;
  /** Groups where money is still outstanding, and what is owed. */
  outstanding: { groupName: string; currency: string; amount: number }[];
}

/** What a person is about to lose, and what will survive them. */
export async function deletionSummary(userId: string): Promise<DeletionSummary> {
  const [photos, owed] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(evidence)
      .where(and(eq(evidence.userId, userId), isNull(evidence.deletedAt))),
    db.execute(sql`
      SELECT g.name AS group_name, l.currency,
             SUM(CASE WHEN l.from_user_id = ${userId} THEN l.amount ELSE -l.amount END)::int AS amount
      FROM ledger_entries l
      JOIN groups g ON g.id = l.group_id
      WHERE ${userId} IN (l.from_user_id, l.to_user_id)
      GROUP BY g.name, l.currency
      HAVING SUM(CASE WHEN l.from_user_id = ${userId} THEN l.amount ELSE -l.amount END) > 0
    `),
  ]);

  const rows = (owed as unknown as { rows?: Record<string, unknown>[] }).rows ??
    (owed as unknown as Record<string, unknown>[]);

  return {
    photos: photos[0]?.n ?? 0,
    outstanding: rows.map((r) => ({
      groupName: String(r.group_name),
      currency: String(r.currency),
      amount: Number(r.amount),
    })),
  };
}

/**
 * Delete photographs. The objects go from the bucket first, then the rows are
 * marked, for the same reason the nightly sweep does it in that order: a row
 * saying a photo is gone while the file survives is the failure that matters.
 */
export async function deletePhotos(
  userId: string,
  typeKey?: string,
): Promise<number> {
  const rows = await db
    .select({ id: evidence.id, objectKey: evidence.objectKey })
    .from(evidence)
    .where(
      and(
        eq(evidence.userId, userId),
        isNull(evidence.deletedAt),
        typeKey ? eq(evidence.typeKey, typeKey) : sql`true`,
      ),
    );

  let gone = 0;
  for (const row of rows) {
    try {
      await deleteObject(row.objectKey);
      await db
        .update(evidence)
        .set({ deletedAt: new Date() })
        .where(eq(evidence.id, row.id));
      gone += 1;
    } catch {
      // Leave the row: it is the only pointer to a file still in the bucket,
      // and the nightly sweep will try again.
    }
  }
  return gone;
}

/**
 * Delete one activity's history, or all of it.
 *
 * The derived rows go outright. The check-in events stay, detached from the
 * person and with their payload reduced to the type and the period, so what
 * survives is "somebody checked this in that day" and nothing more.
 */
export async function deleteHistory(userId: string, typeKey?: string): Promise<void> {
  await deletePhotos(userId, typeKey);

  const scoped = <T extends { typeKey: unknown }>(t: T) =>
    typeKey ? eq(t.typeKey as never, typeKey) : sql`true`;

  await db
    .delete(activityScores)
    .where(and(eq(activityScores.userId, userId), scoped(activityScores)));
  await db
    .delete(activityOutcomes)
    .where(and(eq(activityOutcomes.userId, userId), scoped(activityOutcomes)));

  // Reputation is a running score over everything, so removing one activity's
  // history means the whole replay is stale. Drop it; the next run rebuilds it.
  await db.delete(reputationDaily).where(eq(reputationDaily.userId, userId));

  await db
    .update(events)
    .set({
      userId: null,
      sessionId: null,
      payload: sql`jsonb_build_object(
        'type_key', ${events.payload}->>'type_key',
        'period_start', ${events.payload}->>'period_start',
        'deleted', true
      )`,
    })
    .where(
      and(
        eq(events.userId, userId),
        like(events.type, "checkin.%"),
        typeKey ? sql`${events.payload}->>'type_key' = ${typeKey}` : sql`true`,
      ),
    );

  if (typeKey) {
    await db
      .delete(userActivityConfig)
      .where(
        and(
          eq(userActivityConfig.userId, userId),
          eq(userActivityConfig.typeKey, typeKey),
        ),
      );
    await db
      .delete(userActivities)
      .where(
        and(eq(userActivities.userId, userId), eq(userActivities.typeKey, typeKey)),
      );
  } else {
    await db.delete(userActivityConfig).where(eq(userActivityConfig.userId, userId));
    await db.delete(userActivities).where(eq(userActivities.userId, userId));
  }
}

/**
 * Delete the account.
 *
 * Everything personal goes. The user row stays, scrubbed, because ledger rows
 * point at it and a debt with no counterparty is not a debt. Signing in becomes
 * impossible: the sessions and the linked provider accounts go with it.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await deleteHistory(userId);

  await db.delete(memberShares).where(eq(memberShares.userId, userId));
  await db.delete(userSettings).where(eq(userSettings.userId, userId));

  // Memberships are marked left rather than removed, so a group's history keeps
  // the fact that somebody was there and what they owe (decision 17).
  await db
    .update(groupMembers)
    .set({ leftAt: new Date().toISOString().slice(0, 10) })
    .where(and(eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)));

  // Detach every remaining event, including logins and admin actions.
  await db.update(events).set({ userId: null, sessionId: null }).where(eq(events.userId, userId));

  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));

  await db
    .update(users)
    .set({
      name: "Former member",
      // Unique, and unusable as an address.
      email: `deleted-${userId}@deleted.invalid`,
      emailVerified: false,
      image: null,
    })
    .where(eq(users.id, userId));

  // The record that a deletion happened, with nobody attached to it.
  await recordEvent({ type: "account.deleted", payload: { at: new Date().toISOString() } });
}

/** Whether any ledger row still names this person, for the warning. */
export async function hasLedgerRows(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .where(
      sql`${ledgerEntries.fromUserId} = ${userId} OR ${ledgerEntries.toUserId} = ${userId}`,
    );
  return (row?.n ?? 0) > 0;
}

/** Types this user has any history for, for the per-activity delete. */
export async function typesWithHistory(userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ typeKey: activityScores.typeKey })
    .from(activityScores)
    .where(eq(activityScores.userId, userId));
  return rows.map((r) => r.typeKey);
}
