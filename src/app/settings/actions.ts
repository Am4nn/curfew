"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { updateTimezone } from "@/server/settings";
import type { FormState } from "../ui";
import { trimmed } from "@/lib/form";

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
    const tz = trimmed(formData, "timezone");
    if (!tz) return { error: "Enter a timezone." };
    await updateTimezone(user.id, tz);
    revalidatePath("/settings/personal");
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the timezone." };
  }
}

/**
 * Adopt the zone this device reports, from the mismatch bar on Home.
 *
 * Effective from tomorrow, like every other config change (invariant 4): the day
 * in progress was already being judged on the old midnight and moving it now
 * would rewrite periods that have opened.
 */
export async function adoptDeviceTimezoneAction(formData: FormData): Promise<void> {
  const user = await approvedUser();
  const tz = trimmed(formData, "timezone");
  if (!tz) return;
  await updateTimezone(user.id, tz);
  revalidatePath("/", "layout");
}

// An `updateWindowsAction` lived here, naming sleep's four window keys. It went
// with the control on the personal settings screen: sleep's windows are set on
// sleep's own configure screen, drawn from the module's `fields()` like every
// other type's.
