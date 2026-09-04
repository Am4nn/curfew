"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import {
  createGroup,
  inviteToGroup,
  acceptInvite,
  declineInvite,
  leaveGroup,
  revokeInvite,
  makeOwner,
} from "@/server/groups";
import type { FormState } from "./ui";

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
    const name = String(formData.get("name") || "").trim();
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
    const groupId = String(formData.get("groupId"));
    const email = String(formData.get("email") || "").trim();
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
    await acceptInvite(String(formData.get("inviteId")), user.id, user.email);
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
    await declineInvite(String(formData.get("inviteId")), user.email);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not decline the invite." };
  }
}

/**
 * The same decline, for the shared invite rows, which are a client component
 * and want a promise that throws rather than a FormState. `declineInviteAction`
 * above stays for the plain-form callers.
 */
export async function dismissInviteAction(inviteId: string): Promise<void> {
  const user = await approvedUser();
  await declineInvite(inviteId, user.email);
  revalidatePath("/");
  revalidatePath("/groups");
}

export async function leaveGroupAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    await leaveGroup(String(formData.get("groupId")), user.id);
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
    const groupId = String(formData.get("groupId"));
    const targetUserId = String(formData.get("targetUserId"));
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
    const inviteId = String(formData.get("inviteId"));
    const groupId = String(formData.get("groupId"));
    await revokeInvite(inviteId, user.id);
    revalidatePath(`/group/${groupId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not revoke the invite." };
  }
}
