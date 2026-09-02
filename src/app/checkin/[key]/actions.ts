"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { previewEnabled } from "@/lib/preview";
import { performCheckin, type CheckinResult } from "@/server/checkin";

// The only write on this screen, and it is a POST: a server action never runs
// on a GET, so prefetch, tab restore and link previews cannot record anything
// (invariant 9).
export async function checkInAction(input: {
  typeKey: string;
  step: string;
  idem: string;
  note?: string;
  evidence: unknown;
}): Promise<CheckinResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, reason: "untracked", message: "Sign in first." };

  if ((await getApprovalStatus(user.id)) !== "approved") {
    return { ok: false, reason: "untracked", message: "Your account is not approved." };
  }

  // The session is recorded alongside the check-in, which is how a replay from
  // a stale tab can be told apart later.
  const sessionId = previewEnabled()
    ? null
    : ((await auth.api.getSession({ headers: await headers() }))?.session.id ?? null);

  const result = await performCheckin(user.id, sessionId, input);
  if (result.ok) {
    revalidatePath("/");
    revalidatePath(`/checkin/${input.typeKey}`);
    revalidatePath(`/activities/${input.typeKey}`);
  }
  return result;
}
