"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * What a route shows when its data fails.
 *
 * There used to be one boundary, at the root, so a group tab that threw took
 * the whole app down to a centred apology with no way back except the browser.
 * Every section has its own now: the header stays, the failure is named where
 * it happened, and there are two ways out rather than none.
 *
 * Curfew is a clerk, so this states what happened and what can be done. It does
 * not apologise and it does not guess at a cause it cannot know.
 */
export function RouteError({
  error,
  reset,
  title,
  back,
  backLabel = "Back",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** The section that failed, in the words its header uses. */
  title: string;
  /** Where to go instead. Omitted on Home, which is already the way out. */
  back?: string;
  backLabel?: string;
}) {
  useEffect(() => {
    // The server has already logged it; this is for the browser console.
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-dvh px-5 pb-24 pt-5">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <header className="-mx-5 flex items-center gap-[9px] border-b border-rule px-5 pb-[11px]">
          <span className="text-[14px] font-semibold tracking-[0.16em]">{title}</span>
        </header>

        <div className="flex flex-col gap-2">
          <p className="text-[14px] leading-[1.5] text-penalty">
            This did not load. Nothing was changed.
          </p>
          <p className="text-[11.5px] leading-[1.55] text-muted">
            Your check-ins, streaks and standing are unaffected: this screen only
            reads them.
            {error.digest ? ` Reference ${error.digest}.` : ""}
          </p>
        </div>

        <div className="flex gap-[10px]">
          <button
            type="button"
            onClick={reset}
            className="h-[46px] flex-1 border border-fg bg-fg text-[13.5px] font-semibold text-bg active:opacity-70"
          >
            Try again
          </button>
          {back ? (
            <Link
              href={back}
              className="flex h-[46px] flex-1 items-center justify-center border border-rule text-[13.5px] text-fg active:opacity-70"
            >
              {backLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
