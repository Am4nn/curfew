"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { spendGrace, type SpendResult } from "@/server/restore";

// Spending grace. One action, reached from Home and from the grace screen,
// because it is the same press either way (items 19 and 20).

/**
 * Press Restore.
 *
 * It takes a type key and nothing else. What the restore costs and what it
 * brings back are worked out on the server from the same walk that drew the
 * button, so a stale tab, a second press, or a hand-made POST buys nothing it
 * should not: the offer is either still open at the price the server computes,
 * or it is refused.
 *
 * Returns the refusal rather than throwing, because "you cannot afford that"
 * is a sentence the sheet has to show rather than an error.
 */
export async function restoreStreakAction(typeKey: string): Promise<SpendResult> {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
  if ((await getApprovalStatus(user.id)) !== "approved") {
    throw new Error("Your account is not approved.");
  }

  const result = await spendGrace(user.id, typeKey);
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/grace");
    revalidatePath("/settings");
    revalidatePath(`/activities/${typeKey}`);
  }
  return result;
}
