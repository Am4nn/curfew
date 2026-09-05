"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { recordConsent } from "@/server/consent";
import { setInitialTimezone } from "@/server/settings";
import { trimmed } from "@/lib/form";

export async function acceptConsentAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  await recordConsent(user.id);

  // The zone the gate showed them, from their device. Ordered after consent and
  // unable to fail: it writes only when the account has no zone of its own, and
  // an unknown zone is ignored rather than thrown, so nothing about the timezone
  // can stop somebody consenting.
  const timezone = trimmed(formData, "timezone");
  if (timezone) await setInitialTimezone(user.id, timezone);

  revalidatePath("/", "layout");
}
