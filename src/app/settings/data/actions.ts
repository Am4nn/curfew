"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { previewEnabled } from "@/lib/preview";
import { deletePhotos, deleteHistory, deleteAccount } from "@/server/deletion";
import { deleteOnePhoto } from "@/server/evidence";

async function me() {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again.");
  return user;
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
