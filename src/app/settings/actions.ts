"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import {
  updateTimezone,
  updateSleepWindows,
  updateGroupRules,
} from "@/server/settings";
import { minorUnitExponent } from "@/domain";
import type { FormState } from "../ui";

async function approvedUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
  if ((await getApprovalStatus(user.id)) !== "approved") {
    throw new Error("Your account is not approved.");
  }
  return user;
}

export async function updateTimezoneAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    const tz = String(formData.get("timezone") || "").trim();
    if (!tz) return { error: "Enter a timezone." };
    await updateTimezone(user.id, tz);
    revalidatePath("/settings/personal");
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the timezone." };
  }
}

export async function updateWindowsAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    const f = (k: string) => String(formData.get(k) || "");
    await updateSleepWindows(user.id, {
      night_open: f("night_open"),
      night_close: f("night_close"),
      wake_open: f("wake_open"),
      wake_close: f("wake_close"),
      confirm_open: f("confirm_open"),
      confirm_close: f("confirm_close"),
    });
    revalidatePath("/settings/personal");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Those window times are not valid." };
  }
}

export async function updateGroupRulesAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    const groupId = String(formData.get("groupId"));
    const activityId = String(formData.get("activityId"));
    const currency = String(formData.get("currency") || "INR").toUpperCase();
    const fineMajor = Number(formData.get("fineAmount"));
    const gracePerMonth = Number(formData.get("gracePerMonth"));

    if (!Number.isFinite(fineMajor) || fineMajor <= 0) {
      return { error: "Enter a fine amount." };
    }
    const fineAmount = Math.round(fineMajor * 10 ** minorUnitExponent(currency));
    await updateGroupRules(groupId, activityId, user.id, {
      fineAmount,
      currency,
      gracePerMonth,
    });
    revalidatePath(`/group/${groupId}/rules`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the shared rules." };
  }
}
