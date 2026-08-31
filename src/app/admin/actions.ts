"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { isAdmin, decideApproval } from "@/server/admin";

export async function decideAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("unauthorized");
  if (!(await isAdmin(user.id))) throw new Error("not an admin");

  const userId = String(formData.get("userId"));
  const approve = String(formData.get("approve")) === "true";
  await decideApproval(user.id, userId, approve);
  revalidatePath("/admin");
}
