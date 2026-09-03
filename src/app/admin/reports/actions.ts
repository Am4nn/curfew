"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { requireCapability } from "@/server/admin";
import { reviewReport, banUser } from "@/server/reports";

async function admin() {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
  await requireCapability(user.id, "users.disable");
  return user;
}

export async function reviewReportAction(input: {
  reportId: number;
  outcome: "upheld" | "dismissed";
  removePhoto: boolean;
}): Promise<void> {
  const user = await admin();
  await reviewReport({ ...input, adminId: user.id });
  revalidatePath("/admin/reports");
}

export async function banUserAction(input: {
  userId: string;
  reason: string;
}): Promise<void> {
  const user = await admin();
  await banUser({ ...input, adminId: user.id });
  revalidatePath("/admin/reports");
  revalidatePath("/admin/users");
}
