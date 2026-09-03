"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import {
  requireCapability,
  decideApproval,
  setRole,
  disableUser,
  restoreUser,
  archiveGroup,
  restoreGroup,
  runRebuild,
} from "@/server/admin";
import { isRole, type Capability } from "@/lib/capabilities";
import type { FormState } from "../ui";

async function guard(capability: Capability) {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
  // A disabled account has no access, even if its role still carries the
  // capability. This is the server-action path that bypasses the layout gate.
  if ((await getApprovalStatus(user.id)) !== "approved") {
    throw new Error("Your account is not active.");
  }
  await requireCapability(user.id, capability);
  return user;
}

export async function decideAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await guard("users.approve");
    const userId = String(formData.get("userId"));
    const approve = String(formData.get("approve")) === "true";
    await decideApproval(user.id, userId, approve);
    revalidatePath("/admin");
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update the account." };
  }
}

export async function setRoleAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await guard("users.set_role");
    const targetUserId = String(formData.get("userId"));
    const role = String(formData.get("role"));
    if (!isRole(role)) return { error: "Unknown role." };
    await setRole(user.id, targetUserId, role);
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${targetUserId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not change the role." };
  }
}

export async function disableUserAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await guard("users.disable");
    await disableUser(user.id, String(formData.get("userId")));
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${formData.get("userId")}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not remove the user." };
  }
}

export async function restoreUserAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await guard("users.disable");
    await restoreUser(user.id, String(formData.get("userId")));
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${formData.get("userId")}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not restore the user." };
  }
}

export async function archiveGroupAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await guard("groups.archive");
    await archiveGroup(user.id, String(formData.get("groupId")));
    revalidatePath("/admin/groups");
    revalidatePath(`/admin/groups/${formData.get("groupId")}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not archive the group." };
  }
}

export async function restoreGroupAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await guard("groups.archive");
    await restoreGroup(user.id, String(formData.get("groupId")));
    revalidatePath("/admin/groups");
    revalidatePath(`/admin/groups/${formData.get("groupId")}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not restore the group." };
  }
}

export async function runRebuildAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await guard("ops.score");
    const from = String(formData.get("from") || "").trim() || undefined;
    const to = String(formData.get("to") || "").trim() || undefined;
    const result = await runRebuild(user.id, { from, to });
    revalidatePath("/admin/ops");
    return {
      ok: true,
      note: `Rewrote ${result.scores} score(s) and ${result.outcomes} outcome(s) across ${result.users} user(s).`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Rebuild failed." };
  }
}
