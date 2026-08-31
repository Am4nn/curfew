import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { groups, groupMembers, activities, groupInvites, balances } from "@/db/schema";
import { assertMember } from "./membership";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

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
    .values({ groupId: g.id, userId, role: "owner", joinedAt: today() });
  await db
    .insert(activities)
    .values({ groupId: g.id, typeKey: "sleep", period: "day", createdBy: userId });
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
  await db
    .insert(groupInvites)
    .values({ groupId, email: clean, invitedBy: inviterId })
    .onConflictDoNothing();
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
  await db
    .insert(groupMembers)
    .values({ groupId: inv.groupId, userId, role: "member", joinedAt: today() })
    .onConflictDoNothing();
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

// Leaving sets left_at; the membership row and the balance both survive.
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  await db
    .update(groupMembers)
    .set({ leftAt: today() })
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
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
}

export async function listInvitesForEmail(email: string): Promise<PendingInvite[]> {
  return db
    .select({ id: groupInvites.id, groupId: groupInvites.groupId, groupName: groups.name })
    .from(groupInvites)
    .innerJoin(groups, eq(groups.id, groupInvites.groupId))
    .where(and(eq(groupInvites.email, email.toLowerCase()), eq(groupInvites.status, "pending")));
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
