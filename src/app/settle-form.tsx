"use client";

import { useState } from "react";
import { settleAction } from "./settle-actions";
import { ActionForm, SubmitButton } from "./ui";

// Payer settles a debt. Amount is in major units, defaulting to the full
// outstanding balance but editable for a partial payment.
export function SettleForm({
  groupId,
  toUserId,
  toName,
  currency,
  defaultMajor,
}: {
  groupId: string;
  toUserId: string;
  toName: string;
  currency: string;
  defaultMajor: string;
}) {
  const [amount, setAmount] = useState(defaultMajor);

  return (
    <ActionForm action={settleAction} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="toUserId" value={toUserId} />
      <input type="hidden" name="currency" value={currency} />
      <input
        name="amount"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-label={`Amount settled to ${toName}`}
        className="w-24 border border-fg bg-transparent px-2 py-[6px] text-right text-[14px] text-fg"
      />
      <SubmitButton
        pendingLabel="Recording"
        className="border border-fg bg-fg px-3 py-[7px] text-[13px] text-bg"
      >
        Mark settled
      </SubmitButton>
    </ActionForm>
  );
}
