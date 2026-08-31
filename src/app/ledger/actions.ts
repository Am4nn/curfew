"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, getApprovalStatus } from "@/lib/session";
import { assertMember } from "@/server/membership";
import { recordSettlement } from "@/server/ledger";
import { minorUnitExponent } from "@/domain";

// The payer records a settlement they made: from = the logged-in user, to = the
// creditor. Amount comes in as major units and is converted with the currency's
// own exponent. Appends a ledger row; never mutates.
export async function settleAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("unauthorized");
  if ((await getApprovalStatus(user.id)) !== "approved") {
    throw new Error("not approved");
  }

  const groupId = String(formData.get("groupId"));
  const toUserId = String(formData.get("toUserId"));
  const currency = String(formData.get("currency") || "INR");
  const amountMajor = Number(formData.get("amount"));

  if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
    throw new Error("enter a positive amount");
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
}
