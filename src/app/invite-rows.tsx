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
 * explaining what a group can see, which read as a permanent notice rather
 * than as a thing you deal with and it goes.
 *
 * It is a plain box with a cross now. The box is what separates it from the
 * screen without shouting, the cross is what makes it read as dismissable, and
 * Accept is the only button, because a word beside a button was the chunky
 * part. Declining removes the box on the press and reconciles when the server
 * answers; the section goes when the last one does.
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
    <section className="flex flex-col gap-[10px]">
      {shown.map((invite) => (
        <div
          key={invite.id}
          className="flex flex-col gap-[10px] border border-rule px-[13px] py-3"
        >
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
              <span className="text-[10px] tracking-[0.16em] text-accent">AN INVITE</span>
              <span className="text-[14px]">{invite.groupName}</span>
              <span className="text-[11.5px] leading-[1.45] text-muted">
                {invite.inviterName} invited you
              </span>
            </div>
            {/* Declining is the cross, not a second button. A dismiss is what
                makes the box read as something that goes away, and one word
                beside one button was the chunky part. */}
            <button
              type="button"
              disabled={pending}
              aria-label={`Decline the invite to ${invite.groupName}`}
              onClick={() =>
                run(async () => {
                  dismiss(invite.id);
                  await dismissInviteAction(invite.id);
                })
              }
              className="-mr-1 -mt-1 flex h-7 w-7 flex-none items-center justify-center text-muted active:opacity-70 disabled:opacity-40"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
                aria-hidden="true"
              >
                <path d="M6 6 18 18" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </div>
          <Link
            href={`/join/${invite.id}`}
            className={buttonClass("primary", "sm", "self-start")}
            aria-disabled={pending}
          >
            Accept
          </Link>
        </div>
      ))}
      {error ? <span className="text-[11.5px] text-penalty">{error}</span> : null}
    </section>
  );
}
