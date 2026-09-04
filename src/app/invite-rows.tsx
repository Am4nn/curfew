"use client";

import Link from "next/link";
import { useOptimistic } from "react";
import { useServerAction, buttonClass } from "./ui";
import { dismissInviteAction } from "./actions";

export interface InviteRow {
  id: string;
  inviterName: string;
  groupName: string;
}

/**
 * Invites waiting, on Home and on Groups, drawn the same way in both.
 *
 * This was a tinted panel with a coloured bar down its side and a sentence
 * explaining what a group can see. It read as a permanent notice rather than
 * as a thing you deal with and it goes. So it is two decisions on one row:
 * Accept, or Decline. Declining removes the row on the press and reconciles
 * when the server answers; the whole section goes when the last one does.
 *
 * Accept opens the join screen rather than joining on the spot, because joining
 * means choosing what to share, and that is not a decision to take from a
 * button on the home page.
 */
export function InviteRows({ invites }: { invites: InviteRow[] }) {
  const { run, pending, error } = useServerAction();
  const [shown, dismiss] = useOptimistic(invites, (rows: InviteRow[], id: string) =>
    rows.filter((r) => r.id !== id),
  );

  if (shown.length === 0) return null;

  return (
    <section className="flex flex-col gap-[11px]">
      <span className="text-[10px] tracking-[0.16em] text-accent">
        {shown.length === 1 ? "AN INVITE" : `${shown.length} INVITES`}
      </span>
      <div className="flex flex-col">
        {shown.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-col gap-[11px] border-b border-rule pb-[14px] [&+div]:pt-[14px]"
          >
            <div className="flex flex-col gap-[3px]">
              <span className="text-[14px]">{invite.groupName}</span>
              <span className="text-[11.5px] leading-[1.45] text-muted">
                {invite.inviterName} invited you
              </span>
            </div>
            <div className="flex items-center gap-[9px]">
              <Link
                href={`/join/${invite.id}`}
                className={buttonClass("primary", "md")}
                aria-disabled={pending}
              >
                Accept
              </Link>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    dismiss(invite.id);
                    await dismissInviteAction(invite.id);
                  })
                }
                className="h-[38px] px-[6px] text-[13px] text-muted active:opacity-70 disabled:opacity-40"
              >
                {pending ? "Declining" : "Decline"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error ? <span className="text-[11.5px] text-penalty">{error}</span> : null}
    </section>
  );
}
