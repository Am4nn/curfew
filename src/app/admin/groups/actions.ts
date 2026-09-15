"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { requireCapability } from "@/server/admin";
import { setMoneyOverride, type MoneyOverride } from "@/server/group-controls";

export async function setMoneyOverrideAction(
  groupId: string,
  value: MoneyOverride,
): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("not signed in");
  await requireCapability(user.id, "settings.write");
  await setMoneyOverride(groupId, value, user.id);
  revalidatePath("/admin/groups");
}

// There was a setArchivedAction here, called by the Archive control on a row in
// the groups list. Both went with item 26: an exported server action is a live
// endpoint whether or not anything renders a button for it.
