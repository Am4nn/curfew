"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { requireCapability } from "@/server/admin";
import { saveControls, type PendingChange } from "@/server/controls";

export interface SaveControlsInput {
  changes: PendingChange[];
  notify: boolean;
  /** Composed from the confirm sheet's own blocks, never typed by hand. */
  notice: string;
}

export async function saveControlsAction(input: SaveControlsInput): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("not signed in");
  await requireCapability(user.id, "settings.write");

  // The notice is written only when the box was ticked (decision 57). It is
  // unticked by default, so announcing a change is always a deliberate act.
  await saveControls(input.changes, user.id, input.notify ? input.notice : undefined);

  revalidatePath("/admin/controls");
  revalidatePath("/", "layout");
}
