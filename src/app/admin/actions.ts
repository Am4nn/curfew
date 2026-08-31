"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { isAdmin, decideApproval } from "@/server/admin";
import type { FormState } from "../ui";

export async function decideAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Please sign in again." };
    if (!(await isAdmin(user.id))) return { error: "You are not an admin." };

    const userId = String(formData.get("userId"));
    const approve = String(formData.get("approve")) === "true";
    await decideApproval(user.id, userId, approve);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update the account." };
  }
}
