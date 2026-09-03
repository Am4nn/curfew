"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { saveUserActivity, stopTracking } from "@/server/activities";
import { getAppConfig } from "@/server/app-config";
import type { ScheduleConfig } from "@/domain";

export async function saveActivityAction(input: {
  typeKey: string;
  schedule: ScheduleConfig;
  config: unknown;
  /** Set when the activity was added from a join screen, to return there. */
  returnTo?: string;
  /**
   * From a join screen, whether to return and pick up the sharing step, or
   * stop here having added it for the person alone (decision: "Add for
   * myself only" never re-enters the join flow, so the type is never shared
   * with the inviting group unless the person comes back and turns it on
   * themselves in Settings).
   */
  share?: boolean;
}): Promise<{ redirectTo: string | null }> {
  const user = await getSessionUser();
  if (!user) throw new Error("not signed in");

  // A type is offered only when it has a row and that row is enabled
  // (decision 63). Checked here as well as on the catalog, because a disabled
  // type must not be addable by anyone who kept the page open.
  const { enabledTypes } = await getAppConfig();
  if (!enabledTypes.includes(input.typeKey)) {
    throw new Error("That activity is not available.");
  }

  await saveUserActivity({
    userId: user.id,
    typeKey: input.typeKey,
    enabled: true,
    schedule: input.schedule,
    config: input.config,
  });

  revalidatePath("/activities");
  revalidatePath(`/activities/${input.typeKey}`);

  // Only ever an in-app path, never something the caller can point outward.
  // Returned rather than redirect()ed: this action is invoked as a plain
  // awaited call from a client transition, not a <form action>, and a
  // server-thrown redirect there does not reliably reach the router — the
  // caller navigates itself once this resolves.
  if (input.share !== false && input.returnTo?.startsWith("/join/")) {
    return { redirectTo: input.returnTo };
  }
  return { redirectTo: null };
}

export async function stopTrackingAction(typeKey: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("not signed in");
  await stopTracking(user.id, typeKey);
  revalidatePath("/activities");
  redirect("/activities");
}
