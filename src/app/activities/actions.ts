"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { conditionIdOf } from "@/domain";
import { retireCondition } from "@/server/conditions";
import { saveUserActivity, getUserActivity } from "@/server/activities";

/**
 * Put a written condition away.
 *
 * TWO things, and they are different: retiring stops the label being offered
 * or written again, and switching the activity off stops it being scored. One
 * without the other leaves either a condition still being judged or a name
 * nobody can reuse on something still running.
 *
 * The history stays either way (invariant 1).
 */
export async function putAwayCondition(typeKey: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const id = conditionIdOf(typeKey);
  if (!id) return;

  // Yours, or nothing happens. `retireCondition` is scoped to the user id as
  // well, so this is the second of two checks rather than the only one.
  const mine = await getUserActivity(user.id, typeKey);
  if (!mine) return;

  await saveUserActivity({
    userId: user.id,
    typeKey,
    enabled: false,
    schedule: mine.schedule,
    config: mine.config,
  });
  await retireCondition(user.id, id);

  revalidatePath("/activities");
  revalidatePath("/activities/add");
  revalidatePath("/");
}
