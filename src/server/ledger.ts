import { and, eq, or, isNull, lte, gt, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { ledgerEntries, groups, groupMembers, users } from "@/db/schema";
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
 * Turn missed periods into fine rows: one row per member who PASSED that period
 * and shares that type, the fine split equally among them.
 *
 * A fine is a debt to specific people, so with nobody who passed there is no
 * creditor and nothing is written (decision 107). That keeps invariant 7 exact:
 * every fine sums to its shares, because there are always shares.
 *
 * Idempotent through ledger_one_fine_idx, so re-running the scorer never
 * double-charges.
 */
export async function writeFines(outcomes: OutcomeRow[]): Promise<number> {
  const failed = outcomes.filter((o) => !o.passed && o.fineAmount > 0);
  if (failed.length === 0) return 0;

  const rows: (typeof ledgerEntries.$inferInsert)[] = [];

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

    for (const share of splitFine(o.fineAmount, recipients)) {
      rows.push({
        groupId: o.groupId,
        typeKey: o.typeKey,
        fromUserId: o.userId,
        toUserId: share.toUserId,
        amount: share.amount,
        currency: o.currency,
        kind: "fine",
        periodStart: o.periodStart,
      });
    }
  }

  if (rows.length === 0) return 0;
  const inserted = await db
    .insert(ledgerEntries)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: ledgerEntries.id });
  return inserted.length;
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
  const [row] = await db
    .insert(ledgerEntries)
    .values({
      groupId: input.groupId,
      fromUserId: input.payeeUserId,
      toUserId: input.payerUserId,
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
    const nameById = new Map(members.map((m) => [m.userId, m.name]));

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
  const uf = alias(users, "uf");
  const ut = alias(users, "ut");
  return db
    .select({
      id: ledgerEntries.id,
      typeKey: ledgerEntries.typeKey,
      fromUserId: ledgerEntries.fromUserId,
      toUserId: ledgerEntries.toUserId,
      fromName: uf.name,
      toName: ut.name,
      amount: ledgerEntries.amount,
      currency: ledgerEntries.currency,
      kind: ledgerEntries.kind,
      periodStart: ledgerEntries.periodStart,
      note: ledgerEntries.note,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .innerJoin(uf, eq(uf.id, ledgerEntries.fromUserId))
    .innerJoin(ut, eq(ut.id, ledgerEntries.toUserId))
    .where(eq(ledgerEntries.groupId, groupId))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(200);
}
