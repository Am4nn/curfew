"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import {
  createGroup,
  inviteToGroup,
  acceptInvite,
  declineInvite,
  leaveGroup,
} from "@/server/groups";

async function requireApproved() {
  const user = await getSessionUser();
  if (!user) throw new Error("unauthorized");
  if ((await getApprovalStatus(user.id)) !== "approved") {
    throw new Error("not approved");
  }
  return user;
}

export async function createGroupAction(formData: FormData): Promise<void> {
  const user = await requireApproved();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("group name required");
  await createGroup(user.id, name);
  revalidatePath("/");
}

export async function inviteAction(formData: FormData): Promise<void> {
  const user = await requireApproved();
  const groupId = String(formData.get("groupId"));
  const email = String(formData.get("email") || "").trim();
  if (!email) throw new Error("email required");
  await inviteToGroup(groupId, user.id, email);
  revalidatePath("/");
}

export async function acceptInviteAction(formData: FormData): Promise<void> {
  const user = await requireApproved();
  await acceptInvite(String(formData.get("inviteId")), user.id, user.email);
  revalidatePath("/");
}

export async function declineInviteAction(formData: FormData): Promise<void> {
  const user = await requireApproved();
  await declineInvite(String(formData.get("inviteId")), user.email);
  revalidatePath("/");
}

export async function leaveGroupAction(formData: FormData): Promise<void> {
  const user = await requireApproved();
  await leaveGroup(String(formData.get("groupId")), user.id);
  revalidatePath("/");
}
