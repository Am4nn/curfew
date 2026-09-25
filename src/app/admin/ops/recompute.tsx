"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionForm, SubmitButton, type FormAction } from "../../ui";

// The RECOMPUTE block: two dates, Verify, Rebuild.
//
// Verify used to be a `<button form="recompute-range">` on a `<form
// method="get">`, which is a native form submit, which is a full document
// navigation. Pressing it tore the whole page down and built it again: the
// admin header, the fonts, every route segment, the scroll position. It read as
// the page reloading because that is exactly what it was.
//
// Two things follow from moving it here. `router` navigates the route segment
// only, so the page stays up; and a transition keeps `pending` true until the
// new server render lands, so the button can say it is working. A GET form can
// do neither, because the browser has left by the time React would have
// rendered anything.
//
// The range is one piece of state shared by both controls, which fixes the
// second defect in the same move. Rebuild's hidden inputs used to carry the
// range as the SERVER last rendered it, not the range in the boxes, so editing
// the dates and pressing Rebuild without pressing Verify first rewrote a
// different range from the one on screen. Rebuild writes. That is not a
// difference to leave to whether somebody remembered to press the other button.
export function Recompute({
  from,
  to,
  canVerify,
  canRebuild,
  rebuild,
}: {
  from: string;
  to: string;
  canVerify: boolean;
  canRebuild: boolean;
  rebuild: FormAction;
}) {
  const router = useRouter();
  const [range, setRange] = useState({ from, to });
  const [verifying, startTransition] = useTransition();

  // The drift report is computed by the server render, every time, for whatever
  // range the URL carries. So verifying is navigating: put the range in the URL
  // and let the page render again.
  //
  // Unchanged dates are the common press, and a push to the address you are
  // already at is entitled to do nothing. `refresh()` is what re-runs the server
  // component in place, which is the whole point of the button: "check again,
  // now". Both sit inside the transition, so either way the button stays busy
  // until the answer is on screen.
  const dirty = range.from !== from || range.to !== to;
  function verify() {
    startTransition(() => {
      if (dirty) {
        const query = new URLSearchParams({ from: range.from, to: range.to });
        router.push(`/admin/ops?${query.toString()}`, { scroll: false });
      } else {
        router.refresh();
      }
    });
  }

  // An empty date box would submit nothing and silently get the default range
  // back, which looks like the button ignoring you.
  const ready = range.from !== "" && range.to !== "";

  return (
    <section className="mb-8 flex flex-col gap-2.5">
      <h2 className="text-sm font-semibold tracking-wider">RECOMPUTE</h2>
      <div className="flex flex-col gap-[7px]">
        <span className="text-2xs tracking-wide text-muted">Range</span>
        <div className="flex items-center gap-[9px]">
          <input
            type="date"
            aria-label="From"
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="flex-1 border border-rule bg-transparent px-3 py-2.5 text-base"
          />
          <span className="text-2xs text-muted">to</span>
          <input
            type="date"
            aria-label="To"
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="flex-1 border border-rule bg-transparent px-3 py-2.5 text-base"
          />
        </div>
      </div>
      <div className="flex gap-2.5">
        {canVerify ? (
          <button
            type="button"
            onClick={verify}
            disabled={verifying || !ready}
            aria-busy={verifying || undefined}
            className={
              "h-11 border border-rule px-4 text-base active:opacity-70 disabled:opacity-40" +
              (verifying ? " opacity-60" : "")
            }
          >
            {verifying ? "Verifying" : "Verify"}
          </button>
        ) : null}
        {canRebuild ? (
          <ActionForm action={rebuild}>
            <input type="hidden" name="from" value={range.from} />
            <input type="hidden" name="to" value={range.to} />
            <SubmitButton
              pendingLabel="Rebuilding"
              className="h-11 border border-rule px-4 text-base"
            >
              Rebuild
            </SubmitButton>
          </ActionForm>
        ) : null}
      </div>
      <p className="text-2xs leading-relaxed text-muted">
        Verify recomputes and reports what differs. Rebuild writes the result.
      </p>
    </section>
  );
}
