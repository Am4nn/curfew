"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { requireCapability } from "@/server/admin";
import {
  setMoneyOverride,
  setArchived,
  type MoneyOverride,
} from "@/server/group-controls";

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

export async function setArchivedAction(
  groupId: string,
  archived: boolean,
): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("not signed in");
  await requireCapability(user.id, "groups.archive");
  await setArchived(groupId, archived);
  revalidatePath("/admin/groups");
}
