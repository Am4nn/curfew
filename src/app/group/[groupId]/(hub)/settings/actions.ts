"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import {
  setShare,
  setAccepted,
  setFineRule,
  setOwnerMoneyToggle,
} from "@/server/sharing";
import { leaveGroup } from "@/server/groups";
import { userDay } from "@/server/config";
import { dayAfter } from "@/lib/day-format";
import { minorUnitExponent } from "@/domain";

async function me() {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
  return user;
}

function refresh(groupId: string) {
  revalidatePath(`/group/${groupId}`, "layout");
  revalidatePath("/groups");
}

export async function setShareAction(input: {
  groupId: string;
  typeKey: string;
  shared: boolean;
  shareEvidence: boolean;
}): Promise<void> {
  const user = await me();
  await setShare({ ...input, userId: user.id, changedBy: user.id });
  refresh(input.groupId);
}

export async function setAcceptedAction(input: {
  groupId: string;
  typeKey: string;
  accepted: boolean;
}): Promise<void> {
  const user = await me();
  await setAccepted({ ...input, changedBy: user.id });
  refresh(input.groupId);
}

export async function setMoneyAction(input: {
  groupId: string;
  on: boolean;
}): Promise<void> {
  const user = await me();
  await setOwnerMoneyToggle({ ...input, changedBy: user.id });
  refresh(input.groupId);
}

/** A fine in major units from the form, stored in minor units (invariant 7). */
export async function setFineAction(input: {
  groupId: string;
  typeKey: string;
  amount: number;
  currency: string;
}): Promise<void> {
  const user = await me();
  const exponent = minorUnitExponent(input.currency);
  const minor = Math.round(input.amount * 10 ** exponent);
  if (!Number.isInteger(minor) || minor < 0) {
    throw new Error("That is not an amount.");
  }

  // Tomorrow at the earliest: a fine is scoring config (invariant 4). The
  // owner's own tomorrow, on the app clock: this was `Date.now()` plus a day
  // read in UTC, which for an owner east of Greenwich is a date they are
  // already living, and `setFineRule` would refuse it as being in the past.
  await setFineRule({
    groupId: input.groupId,
    typeKey: input.typeKey,
    fineAmount: minor,
    currency: input.currency,
    effectiveFrom: dayAfter(await userDay(user.id)),
    changedBy: user.id,
  });
  refresh(input.groupId);
}

export async function leaveGroupAction(groupId: string): Promise<void> {
  const user = await me();
  await leaveGroup(groupId, user.id);
  redirect("/groups");
}
