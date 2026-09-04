"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { previewEnabled } from "@/lib/preview";
import { deletePhotos, deleteHistory, deleteAccount } from "@/server/deletion";
import { deleteOnePhoto } from "@/server/evidence";
import { ownPhotos, type SignedPhoto } from "@/server/own-photos";

async function me() {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
  return user;
}

/**
 * The next page of the delete picker.
 *
 * `limit` is how many the sheet wants in total, not an offset, so a re-request
 * after a delete returns a consistent list rather than skipping whatever moved
 * up. Clamped, because it arrives from the client.
 */
export async function morePhotosAction(limit: number): Promise<SignedPhoto[]> {
  const user = await me();
  const want = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 30), 600) : 30;
  return ownPhotos(user.id, { limit: want });
}

export async function deletePhotosAction(): Promise<void> {
  const user = await me();
  await deletePhotos(user.id);
  revalidatePath("/settings/data");
}

export async function deleteOnePhotoAction(evidenceId: number): Promise<void> {
  const user = await me();
  const gone = await deleteOnePhoto(user.id, evidenceId);
  if (!gone) throw new Error("That photo could not be deleted. It may already be gone.");
  revalidatePath("/settings/data");
}

export async function deleteActivityHistoryAction(typeKey: string): Promise<void> {
  const user = await me();
  await deleteHistory(user.id, typeKey);
  revalidatePath("/settings/data");
  revalidatePath("/activities");
}

export async function deleteAllHistoryAction(): Promise<void> {
  const user = await me();
  await deleteHistory(user.id);
  revalidatePath("/settings/data");
  revalidatePath("/activities");
}

export async function deleteAccountAction(): Promise<void> {
  const user = await me();
  await deleteAccount(user.id);
  // Sign out before redirecting: the session rows are gone, but the cookie is
  // not, and a stale cookie is a confusing way to be told you no longer exist.
  if (!previewEnabled()) {
    await auth.api.signOut({ headers: await headers() }).catch(() => {});
  }
  redirect("/signin");
}
