import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { groups, groupMembers, groupInvites, balances, users } from "@/db/schema";
import { assertMember } from "./membership";
import { groupInviteEmail, sendEmailBestEffort } from "./email";
import { userDay } from "./config";

// Joining and leaving are dated in the MEMBER's own zone, not UTC. Both dates
// are read by the scorer as day boundaries, and the grace period is measured
// off the join date, so a UTC date would hand somebody in Kolkata who joined
// at 2 AM a grace period that had already expired.

// Create a group and, since v1 is sleep-only, its one sleep activity, so it is
// usable at once. The creator is the owner, joined today.
export async function createGroup(
  userId: string,
  name: string,
): Promise<{ groupId: string }> {
  const clean = name.trim() || "Group";
  const [g] = await db
    .insert(groups)
    .values({ name: clean, createdBy: userId })
    .returning({ id: groups.id });
  await db
    .insert(groupMembers)
    .values({ groupId: g.id, userId, role: "owner", joinedAt: await userDay(userId) });
  // A new group accepts nothing yet. The owner picks its types on the settings
  // tab, and until then there is nothing for anyone to share.
  return { groupId: g.id };
}

// Invite by email. The invitee sees it on their dashboard once approved. The
// partial unique index on (group_id, email) where pending prevents duplicates.
export async function inviteToGroup(
  groupId: string,
  inviterId: string,
  email: string,
): Promise<void> {
  await assertMember(groupId, inviterId);
  const clean = email.trim().toLowerCase();
  if (!clean) throw new Error("email required");

  // If this email already belongs to an account, guard the two nonsense cases:
  // inviting yourself, and inviting someone already in the group.
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, clean));
  if (existingUser) {
    if (existingUser.id === inviterId) {
      throw new Error("You cannot invite yourself.");
    }
    const [member] = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, existingUser.id),
          isNull(groupMembers.leftAt),
        ),
      );
    if (member) throw new Error("That person is already in this group.");
  }

  const [invite] = await db
    .insert(groupInvites)
    .values({ groupId, email: clean, invitedBy: inviterId })
    .onConflictDoNothing()
    .returning({ id: groupInvites.id });
  if (!invite) return;

  const [group] = await db
    .select({ name: groups.name })
    .from(groups)
    .where(eq(groups.id, groupId));
  if (!group) return;

  const [inviter] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, inviterId));

  await sendEmailBestEffort({
    actorId: inviterId,
    kind: "invite",
    email: groupInviteEmail(clean, inviter?.name ?? "Someone", group.name),
    payload: { group_id: groupId, invite_id: invite.id },
  });
}
export async function acceptInvite(
  inviteId: string,
  userId: string,
  userEmail: string,
): Promise<void> {
  const [inv] = await db
    .select()
    .from(groupInvites)
    .where(eq(groupInvites.id, inviteId));
  if (!inv || inv.status !== "pending") throw new Error("invite is not available");
  if (inv.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error("invite is for a different email");
  }
  // Three cases, and the middle one used to be silent.
  //
  // `onConflictDoNothing` meant that somebody who had LEFT already had a row,
  // with left_at set, so the insert did nothing while the invite was still
  // marked accepted: the invite was spent and the person was not in the group,
  // with no error anywhere.
  //
  // A rejoin starts fresh (decision 110): a new join date, so the score opens
  // from the hidden global score rather than the old number, and the group does
  // not count the day they came back (decision 123). The role is left as it
  // stands, because a rejoin invite can only come from somebody still inside
  // the group, so a returning owner is one of several rather than the last one.
  //
  // NOTHING TOUCHES THE LEDGER. What they owed and were owed comes back with
  // them, which needs no work at all: ledger_entries is append-only and leaving
  // never deleted a row. `/balances` hid the group only because getUserGroups
  // filters on left_at being null, so clearing it makes the debts visible again.
  const [existing] = await db
    .select({ leftAt: groupMembers.leftAt })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, inv.groupId), eq(groupMembers.userId, userId)),
    );

  if (!existing) {
    await db
      .insert(groupMembers)
      .values({ groupId: inv.groupId, userId, role: "member", joinedAt: await userDay(userId) });
  } else if (existing.leftAt !== null) {
    await db
      .update(groupMembers)
      .set({ joinedAt: await userDay(userId), leftAt: null })
      .where(
        and(eq(groupMembers.groupId, inv.groupId), eq(groupMembers.userId, userId)),
      );
  }
  // An active member accepting an invite is a no-op on the membership. Their
  // join date must not move: it is where their history in this group starts,
  // and resetting it would hand them a second grace day and rewrite the lot.

  await db
    .update(groupInvites)
    .set({ status: "accepted", respondedAt: new Date() })
    .where(eq(groupInvites.id, inviteId));
}

export async function declineInvite(
  inviteId: string,
  userEmail: string,
): Promise<void> {
  const [inv] = await db
    .select()
    .from(groupInvites)
    .where(eq(groupInvites.id, inviteId));
  if (!inv || inv.status !== "pending") return;
  if (inv.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error("invite is for a different email");
  }
  await db
    .update(groupInvites)
    .set({ status: "revoked", respondedAt: new Date() })
    .where(eq(groupInvites.id, inviteId));
}

// Leaving sets left_at; the membership row and the balance both survive. The
// owner controls the group's rules and stakes, so the last owner cannot walk
// out on a group that still has members and leave it ownerless. They can leave
// once they are the only one left (the group empties out).
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const active = await db
    .select({ userId: groupMembers.userId, role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)));

  const me = active.find((m) => m.userId === userId);
  if (!me) return; // not an active member; nothing to do

  if (me.role === "owner") {
    const others = active.filter((m) => m.userId !== userId);
    const anotherOwner = others.some((m) => m.role === "owner");
    if (others.length > 0 && !anotherOwner) {
      throw new Error(
        "You are the group owner. You cannot leave while other members remain.",
      );
    }
  }

  await db
    .update(groupMembers)
    .set({ leftAt: await userDay(userId) })
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        isNull(groupMembers.leftAt),
      ),
    );
}

// Promote another active member to owner. Owner-only. The group can then have
// several owners; each controls the rules and can leave while another remains.
export async function makeOwner(
  groupId: string,
  byUserId: string,
  targetUserId: string,
): Promise<void> {
  const active = await db
    .select({ userId: groupMembers.userId, role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)));

  if (active.find((m) => m.userId === byUserId)?.role !== "owner") {
    throw new Error("Only an owner can add another owner.");
  }
  const target = active.find((m) => m.userId === targetUserId);
  if (!target) throw new Error("That person is not a member of this group.");
  if (target.role === "owner") return; // already an owner

  await db
    .update(groupMembers)
    .set({ role: "owner" })
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, targetUserId),
        isNull(groupMembers.leftAt),
      ),
    );
}

export interface UserGroup {
  groupId: string;
  name: string;
  role: string;
  memberCount: number;
}

export async function listUserGroups(userId: string): Promise<UserGroup[]> {
  const rows = await db
    .select({
      groupId: groups.id,
      name: groups.name,
      role: groupMembers.role,
      memberCount: sql<number>`(
        select count(*) from group_members gm
        where gm.group_id = ${groups.id} and gm.left_at is null
      )`,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)));
  return rows.map((r) => ({ ...r, memberCount: Number(r.memberCount) }));
}

export interface PendingInvite {
  id: string;
  groupId: string;
  groupName: string;
  inviterName: string;
}

export async function listInvitesForEmail(email: string): Promise<PendingInvite[]> {
  return db
    .select({
      id: groupInvites.id,
      groupId: groupInvites.groupId,
      groupName: groups.name,
      inviterName: sql<string>`(select name from users where id = ${groupInvites.invitedBy})`,
    })
    .from(groupInvites)
    .innerJoin(groups, eq(groups.id, groupInvites.groupId))
    .where(
      and(
        eq(groupInvites.email, email.toLowerCase()),
        eq(groupInvites.status, "pending"),
        // Dismissed means the recipient hid it. It is still pending and an
        // invite link already in hand still works; it is just not listed.
        isNull(groupInvites.dismissedAt),
      ),
    );
}

/**
 * Hide a pending invite without answering it.
 *
 * Distinct from declining, which revokes the invite and tells the sender no.
 * Someone who dismisses has decided only that they do not want to look at it.
 */
export async function dismissInvite(inviteId: string, userEmail: string): Promise<void> {
  const [inv] = await db.select().from(groupInvites).where(eq(groupInvites.id, inviteId));
  if (!inv || inv.status !== "pending") return;
  if (inv.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error("invite is for a different email");
  }
  await db
    .update(groupInvites)
    .set({ dismissedAt: new Date() })
    .where(eq(groupInvites.id, inviteId));
}

export async function getGroupName(groupId: string): Promise<string | null> {
  const [g] = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, groupId));
  return g?.name ?? null;
}

export interface MemberDetail {
  userId: string;
  name: string;
  role: string;
  joinedAt: string;
  leftAt: string | null;
}

// Every membership row for the group, including people who have left (their
// history and balance survive). Ordered active-first, then by name.
export async function listGroupMembersDetailed(groupId: string): Promise<MemberDetail[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
      leftAt: groupMembers.leftAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId));
  return rows.sort((a, b) => {
    if ((a.leftAt === null) !== (b.leftAt === null)) return a.leftAt === null ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function listGroupPendingInvites(
  groupId: string,
): Promise<{ id: string; email: string }[]> {
  return db
    .select({ id: groupInvites.id, email: groupInvites.email })
    .from(groupInvites)
    .where(and(eq(groupInvites.groupId, groupId), eq(groupInvites.status, "pending")));
}

// Owner-only: withdraw a pending invite.
export async function revokeInvite(inviteId: string, byUserId: string): Promise<void> {
  const [inv] = await db.select().from(groupInvites).where(eq(groupInvites.id, inviteId));
  if (!inv || inv.status !== "pending") return;
  const [m] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, inv.groupId),
        eq(groupMembers.userId, byUserId),
        isNull(groupMembers.leftAt),
      ),
    );
  if (m?.role !== "owner") throw new Error("only the group owner can revoke invites");
  await db
    .update(groupInvites)
    .set({ status: "revoked", respondedAt: new Date() })
    .where(eq(groupInvites.id, inviteId));
}

// Every member's net in one group, from the balances view. Positive means owes.
export async function groupBalances(
  groupId: string,
): Promise<Map<string, { currency: string; netOwed: number }>> {
  const rows = await db
    .select({ userId: balances.userId, currency: balances.currency, netOwed: balances.netOwed })
    .from(balances)
    .where(eq(balances.groupId, groupId));
  const m = new Map<string, { currency: string; netOwed: number }>();
  for (const r of rows) {
    if (r.userId) m.set(r.userId, { currency: r.currency ?? "INR", netOwed: Number(r.netOwed ?? 0) });
  }
  return m;
}

// Per-group net for a user, from the balances view. Positive means owes.
export async function userBalances(
  userId: string,
): Promise<{ groupId: string; currency: string; netOwed: number }[]> {
  const rows = await db
    .select({
      groupId: balances.groupId,
      currency: balances.currency,
      netOwed: balances.netOwed,
    })
    .from(balances)
    .where(eq(balances.userId, userId));
  return rows.map((r) => ({
    groupId: r.groupId ?? "",
    currency: r.currency ?? "INR",
    netOwed: Number(r.netOwed ?? 0),
  }));
}
