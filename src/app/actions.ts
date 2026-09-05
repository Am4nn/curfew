"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import {
  createGroup,
  inviteToGroup,
  acceptInvite,
  declineInvite,
  dismissInvite,
  leaveGroup,
  revokeInvite,
  makeOwner,
} from "@/server/groups";
import type { FormState } from "./ui";
import { field, trimmed } from "@/lib/form";

async function approvedUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
  if ((await getApprovalStatus(user.id)) !== "approved") {
    throw new Error("Your account is not approved.");
  }
  return user;
}

// Each action returns { ok } or { error } for useActionState; failures render
// inline instead of crashing the route.
export async function createGroupAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    const name = trimmed(formData, "name");
    if (!name) return { error: "Enter a group name." };
    if (name.length > 60) return { error: "Group name is too long." };
    await createGroup(user.id, name);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the group." };
  }
}

export async function inviteAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    const groupId = field(formData, "groupId");
    const email = trimmed(formData, "email");
    if (!email) return { error: "Enter an email." };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { error: "That does not look like an email." };
    }
    await inviteToGroup(groupId, user.id, email);
    revalidatePath(`/group/${groupId}`);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send the invite." };
  }
}

export async function acceptInviteAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    await acceptInvite(field(formData, "inviteId"), user.id, user.email);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not accept the invite." };
  }
}

export async function declineInviteAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    await declineInvite(field(formData, "inviteId"), user.email);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not decline the invite." };
  }
}

// The invite card's three controls. Accept is a link to the join screen, so it
// needs no action. These two are promises that throw rather than FormStates,
// which is what the shared client component wants; the FormState versions above
// stay for the plain-form callers.

/** Refuse it. The invite is revoked and the sender can see that. */
export async function refuseInviteAction(inviteId: string): Promise<void> {
  const user = await approvedUser();
  await declineInvite(inviteId, user.email);
  revalidatePath("/");
  revalidatePath("/groups");
}

/**
 * Hide it. The invite stays pending, the sender sees no change, and a link
 * already in hand still works. It just stops being listed.
 */
export async function dismissInviteAction(inviteId: string): Promise<void> {
  const user = await approvedUser();
  await dismissInvite(inviteId, user.email);
  revalidatePath("/");
  revalidatePath("/groups");
}

export async function leaveGroupAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    await leaveGroup(field(formData, "groupId"), user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not leave the group." };
  }
  // Left the group: send them back to the dashboard. redirect() throws, so it
  // must sit outside the try/catch above.
  revalidatePath("/");
  redirect("/");
}

export async function makeOwnerAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    const groupId = field(formData, "groupId");
    const targetUserId = field(formData, "targetUserId");
    await makeOwner(groupId, user.id, targetUserId);
    revalidatePath(`/group/${groupId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update ownership." };
  }
}

export async function revokeInviteAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    const inviteId = field(formData, "inviteId");
    const groupId = field(formData, "groupId");
    await revokeInvite(inviteId, user.id);
    revalidatePath(`/group/${groupId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not revoke the invite." };
  }
}
