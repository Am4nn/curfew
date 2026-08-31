"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { assertMember } from "@/server/membership";
import { recordSettlement } from "@/server/ledger";
import { minorUnitExponent } from "@/domain";
import type { FormState } from "../ui";

// The payer records a settlement they made: from = the logged-in user, to = the
// creditor. Amount comes in as major units and is converted with the currency's
// own exponent. Appends a ledger row; never mutates.
export async function settleAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await getSessionUser();
    if (!user) return { error: "Please sign in again." };
    if ((await getApprovalStatus(user.id)) !== "approved") {
      return { error: "Your account is not approved." };
    }

    const groupId = String(formData.get("groupId"));
    const toUserId = String(formData.get("toUserId"));
    const currency = String(formData.get("currency") || "INR");
    const amountMajor = Number(formData.get("amount"));

    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      return { error: "Enter a positive amount." };
    }

    await assertMember(groupId, user.id);
    await assertMember(groupId, toUserId);

    const amount = Math.round(amountMajor * 10 ** minorUnitExponent(currency));
    await recordSettlement({
      groupId,
      payerUserId: user.id,
      payeeUserId: toUserId,
      amount,
      currency,
    });
    revalidatePath("/ledger");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not record the settlement." };
  }
}
