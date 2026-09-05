import { and, eq, or, isNull, lte, gt, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ledgerEntries, finePostings, groups, groupMembers, users } from "@/db/schema";
import { splitFine } from "@/domain";
import { assertMember } from "./membership";

// One member's outcome for one period in one group.
export interface OutcomeRow {
  groupId: string;
  userId: string;
  typeKey: string;
  periodStart: string;
  passed: boolean;
  fineAmount: number;
  currency: string;
}

/**
 * Names for a set of users, resolved once, for freezing onto ledger rows.
 *
 * Every ledger insert carries the two names as they stand at the moment of
 * writing (migration 0015). A name that cannot be resolved is written as
 * "Former member" rather than left null, because a row with no name is worse
 * than a row with an anonymous one.
 */
async function nameLookup(userIds: string[]): Promise<(id: string) => string> {
  const wanted = [...new Set(userIds)];
  if (wanted.length === 0) return () => "Former member";
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, wanted));
  const byId = new Map(rows.map((r) => [r.id, r.name]));
  return (id) => byId.get(id) ?? "Former member";
}

/**
 * Turn missed periods into fine rows: one row per member who PASSED that period
 * and shares that type, the fine split equally among them.
 *
 * A fine is a debt to specific people, so with nobody who passed there is no
 * creditor and nothing is written (decision 107). That keeps invariant 7 exact:
 * every fine sums to its shares, because there are always shares.
 *
 * THE POSTING IS WRITTEN FIRST, and that order is the whole guard.
 *
 * `ledger_one_fine_idx` makes each SHARE idempotent, which is not the same as
 * making the fine idempotent. The number of shares depends on who has been
 * scored when the split runs, so a split among one peer followed by a split
 * among two inserts the second peer's share beside the first and charges 750
 * for a 500 fine: no row in the table conflicted with anything. The accounting
 * rule is that idempotency belongs on the posting, so a replay cannot write a
 * second set of entries, and `fine_postings` (migration 0017) is that identity.
 *
 * Claim the posting, then write the shares. A conflict means this fine is
 * already charged and the whole split is skipped, including a share that did
 * not exist last time.
 *
 * This codebase has no transactions available (`src/db/index.ts`: the Neon HTTP
 * driver refuses them), so the two writes cannot be one. The order is chosen so
 * that a crash between them leaves a posting with no shares, which is an
 * UNDER-charge that `verify` reports and a person repairs from the amount the
 * posting kept. The other order would leave shares nobody can recognise as
 * already charged, which is the bug this replaces.
 */
export async function writeFines(outcomes: OutcomeRow[]): Promise<number> {
  const failed = outcomes.filter((o) => !o.passed && o.fineAmount > 0);
  if (failed.length === 0) return 0;

  const names = await nameLookup(outcomes.map((o) => o.userId));
  let written = 0;

  for (const o of failed) {
    // Only members who passed the same period, sharing the same type. Someone
    // who does not share Gym here is neither fined for it nor paid for it.
    const recipients = outcomes
      .filter(
        (p) =>
          p.groupId === o.groupId &&
          p.typeKey === o.typeKey &&
          p.periodStart === o.periodStart &&
          p.passed &&
          p.userId !== o.userId,
      )
      .map((p) => p.userId);

    if (recipients.length === 0) continue;

    // Claim it. Nothing back means someone already did, so this fine is
    // charged and the shares below are not ours to write.
    const [posting] = await db
      .insert(finePostings)
      .values({
        groupId: o.groupId,
        typeKey: o.typeKey,
        periodStart: o.periodStart,
        fromUserId: o.userId,
        amount: o.fineAmount,
        currency: o.currency,
      })
      .onConflictDoNothing()
      .returning({ amount: finePostings.amount });
    if (!posting) continue;

    const rows = splitFine(o.fineAmount, recipients).map((share) => ({
      groupId: o.groupId,
      typeKey: o.typeKey,
      fromUserId: o.userId,
      toUserId: share.toUserId,
      fromUserName: names(o.userId),
      toUserName: names(share.toUserId),
      amount: share.amount,
      currency: o.currency,
      kind: "fine",
      periodStart: o.periodStart,
    }));

    const inserted = await db
      .insert(ledgerEntries)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: ledgerEntries.id });
    written += inserted.length;
  }

  return written;
}

// Record a settlement the payer made: one append-only row, never a mutation.
// Membership is checked by the caller (the server action) via assertMember.
//
// The balances view sums from_user as +amount and to_user as -amount, with a
// positive net meaning "owes". A payment must REDUCE the payer's net, so the
// payer is stored as the to_user (credited) and the payee as the from_user.
// Stored this way a settlement nets correctly against the fine rows. The feed
// undoes this for display, showing payer -> payee.
export async function recordSettlement(input: {
  groupId: string;
  payerUserId: string;
  payeeUserId: string;
  amount: number;
  currency?: string;
  note?: string;
}): Promise<{ id: number }> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("settlement amount must be a positive integer in minor units");
  }
  if (input.payerUserId === input.payeeUserId) {
    throw new Error("cannot settle with yourself");
  }
  const names = await nameLookup([input.payerUserId, input.payeeUserId]);
  const [row] = await db
    .insert(ledgerEntries)
    .values({
      groupId: input.groupId,
      fromUserId: input.payeeUserId,
      toUserId: input.payerUserId,
      fromUserName: names(input.payeeUserId),
      toUserName: names(input.payerUserId),
      amount: input.amount,
      currency: input.currency ?? "INR",
      kind: "settlement",
      note: input.note ?? null,
    })
    .returning({ id: ledgerEntries.id });
  return row;
}

export async function getUserGroups(
  userId: string,
): Promise<{ groupId: string; name: string }[]> {
  return db
    .select({ groupId: groups.id, name: groups.name })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)));
}

// Membership is checked HERE, not by the caller. Invariant 10 says every
// group-scoped query goes through assertMember, and a helper that trusts its
// caller is the one that eventually gets called from somewhere that forgot.
export async function listGroupMembers(
  groupId: string,
  viewerId: string,
): Promise<{ userId: string; name: string; leftAt: string | null }[]> {
  await assertMember(groupId, viewerId);
  return db
    .select({
      userId: users.id,
      name: users.name,
      leftAt: groupMembers.leftAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId));
}

export interface LedgerRow {
  id: number;
  typeKey: string | null;
  fromUserId: string;
  toUserId: string;
  fromName: string;
  toName: string;
  amount: number;
  currency: string;
  kind: string;
  periodStart: string | null;
  note: string | null;
  createdAt: Date;
}

export interface Debt {
  otherId: string;
  otherName: string;
  groupId: string;
  groupName: string;
  currency: string;
  amount: number; // minor units, always positive
}

// Every pairwise debt the user has, across all their groups. `owe` are debts the
// user owes (settleable from here); `owed` are debts owed to the user
// (informational: the other person settles from their own screen). A debt is
// per person, per group, per currency, because settlements post to one group's
// ledger. Membership is implicit: getUserGroups only returns the user's groups.
export async function getUserDebts(
  userId: string,
): Promise<{ owe: Debt[]; owed: Debt[] }> {
  const groups = await getUserGroups(userId);
  const owe: Debt[] = [];
  const owed: Debt[] = [];

  for (const g of groups) {
    const [members, rows] = await Promise.all([
      listGroupMembers(g.groupId, userId),
      getGroupLedgerRows(g.groupId, userId),
    ]);
    // A member still in the group is named as they are now; anyone who has
    // left, deletion included, is named by what the ledger froze at the time.
    // Rows arrive newest first, so the first frozen name seen is the latest.
    const nameById = new Map<string, string>();
    for (const r of rows) {
      if (!nameById.has(r.fromUserId)) nameById.set(r.fromUserId, r.fromName);
      if (!nameById.has(r.toUserId)) nameById.set(r.toUserId, r.toName);
    }
    for (const m of members) {
      if (m.leftAt === null) nameById.set(m.userId, m.name);
    }

    // Positive net means the user owes that person, in that currency.
    const net = new Map<string, number>();
    for (const r of rows) {
      if (r.fromUserId === userId) {
        const k = `${r.toUserId}|${r.currency}`;
        net.set(k, (net.get(k) ?? 0) + r.amount);
      } else if (r.toUserId === userId) {
        const k = `${r.fromUserId}|${r.currency}`;
        net.set(k, (net.get(k) ?? 0) - r.amount);
      }
    }

    for (const [k, amount] of net) {
      if (amount === 0) continue;
      const [otherId, currency] = k.split("|");
      const debt: Debt = {
        otherId,
        otherName: nameById.get(otherId) ?? otherId,
        groupId: g.groupId,
        groupName: g.name,
        currency,
        amount: Math.abs(amount),
      };
      if (amount > 0) owe.push(debt);
      else owed.push(debt);
    }
  }

  return { owe, owed };
}

export async function getGroupLedgerRows(
  groupId: string,
  viewerId: string,
): Promise<LedgerRow[]> {
  await assertMember(groupId, viewerId);
  // The frozen names, not a join on users: a member who deleted their account
  // still has to be nameable on what they owe.
  return db
    .select({
      id: ledgerEntries.id,
      typeKey: ledgerEntries.typeKey,
      fromUserId: ledgerEntries.fromUserId,
      toUserId: ledgerEntries.toUserId,
      fromName: ledgerEntries.fromUserName,
      toName: ledgerEntries.toUserName,
      amount: ledgerEntries.amount,
      currency: ledgerEntries.currency,
      kind: ledgerEntries.kind,
      periodStart: ledgerEntries.periodStart,
      note: ledgerEntries.note,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.groupId, groupId))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(200);
}
