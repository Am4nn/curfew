"use client";

import { useActionState, useEffect, useState } from "react";
import { inviteAction } from "../../../actions";
import { SubmitButton } from "../../../ui";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Inviting sends a real email that names the inviter, so it goes through a
// confirm step. The typed address is shown in the warning, so this is a small
// client form rather than the generic ConfirmButton (which takes static fields).
export function InviteForm({ groupId, inviterName }: { groupId: string; inviterName: string }) {
  const [state, formAction] = useActionState(inviteAction, {});
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setEmail("");
    }
  }, [state]);

  const valid = EMAIL_RE.test(email.trim());

  return (
    <form action={formAction}>
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex items-center gap-2">
        <input
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (valid) setOpen(true);
            }
          }}
          placeholder="email address"
          className="flex-1 border border-rule bg-transparent px-3 py-[10px] text-[14px]"
        />
        <button
          type="button"
          onClick={() => valid && setOpen(true)}
          disabled={!valid}
          className="border border-rule bg-surface px-4 py-[10px] text-[14px] disabled:opacity-50"
        >
          Send
        </button>
      </div>
      {state.error ? <p className="mt-2 text-[13px] text-penalty">{state.error}</p> : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-[360px] border border-fg bg-bg p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] leading-relaxed">
              An email invite will be sent to{" "}
              <span className="font-semibold">{email.trim()}</span>. It names you
              {inviterName ? (
                <>
                  {" "}
                  (<span className="font-semibold">{inviterName}</span>)
                </>
              ) : null}{" "}
              as the inviter.
            </p>
            {state.error ? (
              <p className="mt-3 text-[13px] text-penalty">{state.error}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border border-fg px-3 py-[8px] text-[13px]"
              >
                Cancel
              </button>
              <SubmitButton
                pendingLabel="Sending"
                className="border border-fg bg-fg px-3 py-[8px] text-[13px] text-bg"
              >
                Send invite
              </SubmitButton>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
