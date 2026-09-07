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
    // Geometry from V3Balances: the field takes the row and the button sits at
    // its end, both 38px tall. It was a 96px box with its number pushed right,
    // which read as a total rather than as something to type in. The button
    // keeps the filled treatment: it is the only thing on the screen that moves
    // money, and the mock's outline made it look like the field's twin.
    <ActionForm action={settleAction} className="mt-3 flex items-center gap-[10px]">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="toUserId" value={toUserId} />
      <input type="hidden" name="currency" value={currency} />
      <input
        name="amount"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-label={`Amount settled to ${toName}`}
        className="h-[38px] flex-1 border border-rule bg-transparent px-[11px] text-[13px] text-fg"
      />
      <SubmitButton
        pendingLabel="Recording"
        className="h-[38px] flex-none border border-fg bg-fg px-[14px] text-[12.5px] font-normal text-bg"
      >
        Mark settled
      </SubmitButton>
    </ActionForm>
  );
}
