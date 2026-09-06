"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { declarePause, extendPause, endPauseEarly, PauseError } from "@/server/pause";
import { trimmed } from "@/lib/form";
import type { FormState } from "../../ui";

async function approvedUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
  if ((await getApprovalStatus(user.id)) !== "approved") {
    throw new Error("Your account is not approved.");
  }
  return user;
}

// A pause changes what every screen says about the day, so all three of these
// revalidate the layout rather than one route.
function refresh() {
  revalidatePath("/", "layout");
}

// PauseError carries the sentence a person should read. Anything else is a bug
// and gets the generic line, so an internal message never reaches a screen.
function message(e: unknown, fallback: string): string {
  return e instanceof PauseError ? e.message : fallback;
}

export async function declarePauseAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    await declarePause(user.id, trimmed(formData, "from"), trimmed(formData, "to"));
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: message(e, "Could not declare the pause.") };
  }
}

export async function extendPauseAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    await extendPause(user.id, trimmed(formData, "to"));
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: message(e, "Could not extend the pause.") };
  }
}

export async function endPauseAction(
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  try {
    const user = await approvedUser();
    await endPauseEarly(user.id);
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: message(e, "Could not end the pause.") };
  }
}
