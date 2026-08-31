"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import {
  isAdmin,
  decideApproval,
  setAdminFlag,
  runScoring,
  runVerify,
} from "@/server/admin";
import { formatMoney } from "@/domain";
import type { FormState } from "../ui";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
  if (!(await isAdmin(user.id))) throw new Error("You are not an admin.");
  return user;
}

export async function decideAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requireAdmin();
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

export async function setAdminAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requireAdmin();
    const targetUserId = String(formData.get("userId"));
    const makeAdmin = String(formData.get("makeAdmin")) === "true";
    await setAdminFlag(user.id, targetUserId, makeAdmin);
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${targetUserId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not change admin access." };
  }
}

export async function runScoringAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requireAdmin();
    const from = String(formData.get("from") || "").trim() || undefined;
    const result = await runScoring(user.id, from);
    revalidatePath("/admin");
    return { ok: true, note: `Scored ${result.users} user(s)${from ? ` from ${from}` : ""}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Scoring failed." };
  }
}

export async function runVerifyAction(
  _state: FormState,
): Promise<FormState> {
  try {
    const user = await requireAdmin();
    const drift = await runVerify(user.id);
    if (drift.length === 0) return { ok: true, note: "No drift. Stored rows match a fresh recompute." };
    const lines = drift
      .slice(0, 20)
      .map((d) => {
        const stored =
          d.field === "fine_amount" && typeof d.stored === "number"
            ? formatMoney(d.stored, "INR")
            : String(d.stored);
        const computed =
          d.field === "fine_amount" && typeof d.computed === "number"
            ? formatMoney(d.computed, "INR")
            : String(d.computed);
        return `${d.kind} ${d.key} ${d.field}: stored=${stored} computed=${computed}`;
      })
      .join("\n");
    return { error: `${drift.length} drift row(s):\n${lines}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Verify failed." };
  }
}
