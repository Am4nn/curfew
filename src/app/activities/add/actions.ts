"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { createCondition, ConditionError } from "@/server/conditions";
import { conditionsEnabled } from "@/server/activities";

// Writing a condition is a POST and nothing else: invariant 9 is about
// check-ins, and this is the same principle one level up. Nothing here runs on
// a page load.
export async function writeCondition(
  label: string,
): Promise<{ typeKey: string; error?: undefined } | { typeKey?: undefined; error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in again." };
  if ((await getApprovalStatus(user.id)) !== "approved") return { error: "Not approved yet." };
  // The admin switch, checked on the way in rather than only on the way out.
  // A catalog rendered before it was turned off still carries the control.
  if (!(await conditionsEnabled())) return { error: "That is switched off." };

  try {
    const condition = await createCondition(user.id, label);
    revalidatePath("/activities");
    revalidatePath("/activities/add");
    revalidatePath("/");
    return { typeKey: condition.typeKey };
  } catch (e) {
    if (e instanceof ConditionError) return { error: e.message };
    throw e;
  }
}
