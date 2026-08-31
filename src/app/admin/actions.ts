"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import {
  requireCapability,
  decideApproval,
  setRole,
  disableUser,
  restoreUser,
  archiveGroup,
  restoreGroup,
  runScoring,
  runVerify,
} from "@/server/admin";
import { isRole, type Capability } from "@/lib/capabilities";
import { formatMoney } from "@/domain";
import type { FormState } from "../ui";

async function guard(capability: Capability) {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
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

export async function runScoringAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await guard("ops.score");
    const from = String(formData.get("from") || "").trim() || undefined;
    const result = await runScoring(user.id, from);
    revalidatePath("/admin");
    return { ok: true, note: `Scored ${result.users} user(s)${from ? ` from ${from}` : ""}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Scoring failed." };
  }
}

export async function runVerifyAction(_state: FormState): Promise<FormState> {
  try {
    const user = await guard("ops.verify");
    const drift = await runVerify(user.id);
    if (drift.length === 0) return { ok: true, note: "No drift. Stored rows match a fresh recompute." };
    const lines = drift
      .slice(0, 20)
      .map((d) => {
        const fmt = (v: unknown) =>
          d.field === "fine_amount" && typeof v === "number" ? formatMoney(v, "INR") : String(v);
        return `${d.kind} ${d.key} ${d.field}: stored=${fmt(d.stored)} computed=${fmt(d.computed)}`;
      })
      .join("\n");
    return { error: `${drift.length} drift row(s):\n${lines}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Verify failed." };
  }
}
