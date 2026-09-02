"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { acknowledgeAll } from "@/server/notices";

// One press clears everything the viewer has pending (decision 81). Acknowledging
// is final, so there is no undo action to pair with this one.
export async function acknowledgeNoticesAction(): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  await acknowledgeAll(user.id);
  revalidatePath("/", "layout");
}
