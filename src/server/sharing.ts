import { and, eq, isNull, or, gt, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  groupActivityTypes,
  groupActivityRules,
  memberShares,
  groupMembers,
} from "@/db/schema";
import { resolveAt, resolveConfig, getActivityType } from "@/domain";
import { assertMember, memberRole } from "./membership";

// The two toggles, and only two (decision 16).
//
// Group side: the owner declares which types the group accepts. Member side:
// for each accepted type, share it here, and share its evidence.
//
// Both are append-only and resolved as they stood on the day being scored, so
// dropping a type or un-sharing one never rewrites what a past period was
// judged against (invariant 5).

export interface AcceptedType {
  typeKey: string;
  name: string;
  icon: string;
}

/** Which types this group accepts, as of an instant. */
export async function acceptedTypes(
  groupId: string,
  asOf: Date = new Date(),
): Promise<AcceptedType[]> {
  const rows = await db
    .select({
      id: groupActivityTypes.id,
      typeKey: groupActivityTypes.typeKey,
      accepted: groupActivityTypes.accepted,
      effectiveAt: groupActivityTypes.effectiveAt,
    })
    .from(groupActivityTypes)
    .where(eq(groupActivityTypes.groupId, groupId));

  const keys = [...new Set(rows.map((r) => r.typeKey))];
  const out: AcceptedType[] = [];
  for (const typeKey of keys) {
    const row = resolveAt(
      rows.filter((r) => r.typeKey === typeKey),
      asOf,
    );
    if (!row?.accepted) continue;
    const type = getActivityType(typeKey);
    out.push({ typeKey, name: type.name, icon: type.icon });
  }
  return out;
}

export interface Share {
  typeKey: string;
  shared: boolean;
  shareEvidence: boolean;
}

/** What one member shares here, as of an instant. Unset means not shared. */
export async function sharesFor(
  groupId: string,
  userId: string,
  asOf: Date = new Date(),
): Promise<Share[]> {
  const rows = await db
    .select({
      id: memberShares.id,
      typeKey: memberShares.typeKey,
      shared: memberShares.shared,
      shareEvidence: memberShares.shareEvidence,
      effectiveAt: memberShares.effectiveAt,
    })
    .from(memberShares)
    .where(and(eq(memberShares.groupId, groupId), eq(memberShares.userId, userId)));

  const keys = [...new Set(rows.map((r) => r.typeKey))];
  const out: Share[] = [];
  for (const typeKey of keys) {
    const row = resolveAt(
      rows.filter((r) => r.typeKey === typeKey),
      asOf,
    );
    if (!row) continue;
    out.push({
      typeKey,
      shared: row.shared,
      shareEvidence: row.shared && row.shareEvidence,
    });
  }
  return out;
}

/**
 * Breadth: types shared over types accepted, on a given day.
 *
 * This is the reputation ceiling's whole input (REPUTATION.md). A group that
 * accepts nothing gives breadth 1 rather than dividing by zero: there is
 * nothing to be narrow about.
 */
export async function breadthFor(
  groupId: string,
  userId: string,
  asOf: Date = new Date(),
): Promise<number> {
  const [accepted, shares] = await Promise.all([
    acceptedTypes(groupId, asOf),
    sharesFor(groupId, userId, asOf),
  ]);
  if (accepted.length === 0) return 1;
  const sharedKeys = new Set(shares.filter((s) => s.shared).map((s) => s.typeKey));
  const counted = accepted.filter((a) => sharedKeys.has(a.typeKey)).length;
  return counted / accepted.length;
}

/** Set one member's two toggles. Append-only, immediate. */
export async function setShare(input: {
  groupId: string;
  userId: string;
  typeKey: string;
  shared: boolean;
  shareEvidence: boolean;
  changedBy: string;
}): Promise<void> {
  await assertMember(input.groupId, input.changedBy);
  // Only the member decides what they share. An owner cannot share on
  // somebody's behalf, which is the point of the member side of the toggle.
  if (input.changedBy !== input.userId) {
    throw new Error("Only you can change what you share.");
  }

  const accepted = await acceptedTypes(input.groupId);
  if (input.shared && !accepted.some((a) => a.typeKey === input.typeKey)) {
    throw new Error("This group does not accept that activity.");
  }

  // A type with no evidence at all cannot share evidence, whatever is ticked.
  const takesEvidence = getActivityType(input.typeKey).evidence.level !== "none";

  await db.insert(memberShares).values({
    groupId: input.groupId,
    userId: input.userId,
    typeKey: input.typeKey,
    shared: input.shared,
    shareEvidence: input.shared && takesEvidence && input.shareEvidence,
    // App clock, not the database's: see the note in saveControls.
    effectiveAt: new Date(),
    changedBy: input.changedBy,
  });
}

/** Accept or drop a type for the whole group. Owners only. */
export async function setAccepted(input: {
  groupId: string;
  typeKey: string;
  accepted: boolean;
  changedBy: string;
}): Promise<void> {
  const role = await memberRole(input.groupId, input.changedBy);
  if (role !== "owner") throw new Error("Only an owner can change what the group accepts.");

  await db.insert(groupActivityTypes).values({
    groupId: input.groupId,
    typeKey: input.typeKey,
    accepted: input.accepted,
    effectiveAt: new Date(),
    changedBy: input.changedBy,
  });
}

// ---------------------------------------------------------------------------
// Fine rules
// ---------------------------------------------------------------------------

export interface FineRule {
  version: number | null;
  fineMode: "flat" | "escalating";
  fineAmount: number;
  fineStep: number;
  fineCap: number | null;
  currency: string;
}

const NO_FINE: FineRule = {
  version: null,
  fineMode: "flat",
  fineAmount: 0,
  fineStep: 0,
  fineCap: null,
  currency: "INR",
};

/**
 * The fine rule for one type in one group, as it stood on a period.
 *
 * Resolved by date rather than instant, because a fine is scoring config: a
 * change lands at a future period start and never rewrites one in progress
 * (invariant 4). No rule means no fine, which is the default for every type.
 */
export async function fineRuleFor(
  groupId: string,
  typeKey: string,
  period: string,
): Promise<FineRule> {
  const rows = await db
    .select({
      version: groupActivityRules.version,
      scopeId: groupActivityRules.groupId,
      effectiveFrom: groupActivityRules.effectiveFrom,
      fineMode: groupActivityRules.fineMode,
      fineAmount: groupActivityRules.fineAmount,
      fineStep: groupActivityRules.fineStep,
      fineCap: groupActivityRules.fineCap,
      currency: groupActivityRules.currency,
    })
    .from(groupActivityRules)
    .where(
      and(eq(groupActivityRules.groupId, groupId), eq(groupActivityRules.typeKey, typeKey)),
    );

  const row = resolveConfig(rows, period);
  if (!row) return NO_FINE;
  return {
    version: row.version,
    fineMode: row.fineMode as "flat" | "escalating",
    fineAmount: row.fineAmount,
    fineStep: row.fineStep,
    fineCap: row.fineCap,
    currency: row.currency,
  };
}

/** Set a fine. Owners only, and never before tomorrow (invariant 4). */
export async function setFineRule(input: {
  groupId: string;
  typeKey: string;
  fineAmount: number;
  currency: string;
  effectiveFrom: string;
  changedBy: string;
}): Promise<void> {
  const role = await memberRole(input.groupId, input.changedBy);
  if (role !== "owner") throw new Error("Only an owner can set a fine.");

  const today = new Date().toISOString().slice(0, 10);
  if (input.effectiveFrom <= today) {
    throw new Error("A fine change takes effect from tomorrow at the earliest.");
  }

  await db
    .insert(groupActivityRules)
    .values({
      groupId: input.groupId,
      typeKey: input.typeKey,
      fineAmount: input.fineAmount,
      currency: input.currency,
      effectiveFrom: input.effectiveFrom,
      changedBy: input.changedBy,
    })
    .onConflictDoUpdate({
      target: [
        groupActivityRules.groupId,
        groupActivityRules.typeKey,
        groupActivityRules.effectiveFrom,
      ],
      set: { fineAmount: input.fineAmount, currency: input.currency },
    });
}

// ---------------------------------------------------------------------------
// Membership spans
// ---------------------------------------------------------------------------

/** Members of a group on a given period: joined by then, not yet left. */
export async function activeMembersOn(
  groupId: string,
  period: string,
): Promise<string[]> {
  const rows = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        lte(groupMembers.joinedAt, period),
        or(isNull(groupMembers.leftAt), gt(groupMembers.leftAt, period)),
      ),
    );
  return rows.map((r) => r.userId);
}
