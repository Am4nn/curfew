"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { recordConsent } from "@/server/consent";

export async function acceptConsentAction(): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  await recordConsent(user.id);
  revalidatePath("/", "layout");
}
