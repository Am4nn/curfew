"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { acceptInvite, declineInvite } from "@/server/groups";
import { setShare } from "@/server/sharing";

async function approved() {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
  if ((await getApprovalStatus(user.id)) !== "approved") {
    throw new Error("Your account is not approved.");
  }
  return user;
}

/**
 * Join, and set what you share in one act.
 *
 * The sharing is written after the membership because setShare checks it. A
 * failure part way leaves the person in the group sharing nothing, which is the
 * safe direction: nothing is exposed that was not chosen.
 */
export async function joinAction(input: {
  inviteId: string;
  groupId: string;
  shares: { typeKey: string; shared: boolean; shareEvidence: boolean }[];
}): Promise<void> {
  const user = await approved();
  await acceptInvite(input.inviteId, user.id, user.email);

  for (const share of input.shares) {
    if (!share.shared) continue;
    await setShare({
      groupId: input.groupId,
      userId: user.id,
      typeKey: share.typeKey,
      shared: true,
      shareEvidence: share.shareEvidence,
      changedBy: user.id,
    });
  }

  revalidatePath("/groups");
  redirect(`/group/${input.groupId}`);
}

export async function declineAction(inviteId: string): Promise<void> {
  const user = await approved();
  await declineInvite(inviteId, user.email);
  revalidatePath("/groups");
  redirect("/groups");
}
