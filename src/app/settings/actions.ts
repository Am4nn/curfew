"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import {
  updateTimezone,
  updateSleepWindows,
  updateGroupRules,
} from "@/server/settings";
import { minorUnitExponent } from "@/domain";

async function requireApproved() {
  const user = await getSessionUser();
  if (!user) throw new Error("unauthorized");
  if ((await getApprovalStatus(user.id)) !== "approved") throw new Error("not approved");
  return user;
}

export async function updateTimezoneAction(formData: FormData): Promise<void> {
  const user = await requireApproved();
  await updateTimezone(user.id, String(formData.get("timezone") || "").trim());
  revalidatePath("/settings");
}

export async function updateWindowsAction(formData: FormData): Promise<void> {
  const user = await requireApproved();
  const f = (k: string) => String(formData.get(k) || "");
  await updateSleepWindows(user.id, {
    night_open: f("night_open"),
    night_close: f("night_close"),
    wake_open: f("wake_open"),
    wake_close: f("wake_close"),
    confirm_open: f("confirm_open"),
    confirm_close: f("confirm_close"),
  });
  revalidatePath("/settings");
}

export async function updateGroupRulesAction(formData: FormData): Promise<void> {
  const user = await requireApproved();
  const groupId = String(formData.get("groupId"));
  const activityId = String(formData.get("activityId"));
  const currency = String(formData.get("currency") || "INR").toUpperCase();
  const fineMajor = Number(formData.get("fineAmount"));
  const gracePerMonth = Number(formData.get("gracePerMonth"));

  if (!Number.isFinite(fineMajor) || fineMajor <= 0) throw new Error("enter a fine amount");
  const fineAmount = Math.round(fineMajor * 10 ** minorUnitExponent(currency));

  await updateGroupRules(groupId, activityId, user.id, {
    fineAmount,
    currency,
    gracePerMonth,
  });
  revalidatePath("/settings");
}
