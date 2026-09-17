"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { setQuietHours, setReminders } from "@/server/reminders";
import { deliver, pushConfigured } from "@/server/push";
import { env } from "@/lib/env";
import type { FormState } from "../../ui";

async function approvedUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
  if ((await getApprovalStatus(user.id)) !== "approved") {
    throw new Error("Your account is not approved.");
  }
  return user;
}

/**
 * Save one activity's reminder times. Clearing them all restores the default,
 * which is why there is no separate reset control.
 */
export async function setRemindersAction(
  typeKey: string,
  times: string[],
): Promise<void> {
  const user = await approvedUser();
  await setReminders(user.id, typeKey, times);
  revalidatePath("/settings/notifications");
}

/**
 * Save the hours nothing may arrive in.
 *
 * A form action rather than a fire-and-forget like `setRemindersAction`,
 * because getting this wrong is the one setting on this screen that can wake
 * somebody at 3:00 AM, and a save that silently failed would leave them
 * believing they had fixed it.
 */
export async function setQuietHoursAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    const from = trimmed(formData, "quietFrom");
    const to = trimmed(formData, "quietTo");
    if (!from || !to) return { error: "Both times are needed." };
    if (from === to) {
      // An empty band is almost certainly not what anybody means, and it reads
      // on screen as "quiet from 10 PM to 10 PM", which looks like a setting
      // rather than like the absence of one.
      return { error: "Those are the same time, which would mean no quiet hours." };
    }
    await setQuietHours(user.id, from, to);
    revalidatePath("/settings/notifications");
    return { ok: true, note: "Saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save it." };
  }
}

function trimmed(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Send one to this account, now.
 *
 * Not a nicety. Without it the only way to find out whether the whole chain
 * works, permission to service worker to VAPID to Apple to the lock screen, is
 * to wait for a real window to nearly close and see whether anything happens.
 * Every part of that chain fails silently, so a failure at 7:50 PM is
 * indistinguishable from nothing being due.
 *
 * Deliberately NOT gated on PUSH_REMINDERS. That flag stops the scheduled tick
 * deciding on its own to message people; this is a person pressing a button
 * about their own device, and dev is where it has to work.
 */
export async function sendTestAction(): Promise<FormState> {
  try {
    const user = await approvedUser();
    if (!pushConfigured()) {
      return { error: "Push is not configured in this environment." };
    }
    const result = await deliver(user.id, {
      title: "Curfew is set up!",
      body: "This is what a reminder looks like. Real ones arrive before a window closes.",
      navigate: `${env.BETTER_AUTH_URL}/`,
      badge: 0,
      // A test is worthless once it is stale: if the phone was off, the person
      // has already stopped looking at it.
      ttlSeconds: 60,
    });
    if (result.sent === 0 && result.gone > 0) {
      return {
        error: "This device is no longer registered. Turn notifications off and on again.",
      };
    }
    if (result.sent === 0) {
      return { error: "No device is registered for this account yet." };
    }
    return {
      ok: true,
      note: `Sent to ${result.sent} ${result.sent === 1 ? "device" : "devices"}.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send it." };
  }
}
