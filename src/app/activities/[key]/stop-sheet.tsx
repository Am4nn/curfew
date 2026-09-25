"use client";

import { useState, useTransition } from "react";
import { STOP_FOOTNOTE, type Consequence } from "@/domain";
import { stopCostAction, stopTrackingAction } from "./actions";

// Stop tracking, with what it costs (item 22, mock V32StopTracking).
//
// This was a bare <form action> and a red button. Four things happen on that
// press and the screen named none of them; one of them cannot be undone, which
// is the reason a confirmation is not decoration here. The photographs a group
// has seen go when sharing stops, and sharing the type again later does not
// bring them back.
//
// The list is composed on the server (`domain/stop-cost.ts`) and fetched when
// the sheet opens, so nothing here decides what a stop costs and nobody pays
// for the query on a visit that was not about stopping.
export function StopSheet({ typeKey, name }: { typeKey: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [cost, setCost] = useState<Consequence[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startLoading] = useTransition();
  const [stopping, startStopping] = useTransition();

  function ask() {
    setError(null);
    setCost(null);
    setOpen(true);
    startLoading(async () => {
      try {
        setCost(await stopCostAction(typeKey));
      } catch {
        // The press still works: the sheet says what it could not work out
        // rather than refusing to open, because a screen that will not let
        // somebody stop tracking is worse than one that stopped counting.
        setError("Could not work out what this costs.");
        setCost([]);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={ask}
        className="h-11 w-full border border-rule text-base text-penalty active:opacity-70"
      >
        Stop tracking {name}
      </button>

      {open ? (
        <div
          className="scrim-in fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: "var(--scrim)" }}
          role="dialog"
          aria-modal="true"
          aria-label={`Stop tracking ${name}`}
        >
          <div className="flex w-full flex-col gap-3.5 border-t border-rule bg-bg px-5 pb-[22px] pt-[18px]">
            <span className="text-lg leading-normal">Stop tracking {name}?</span>

            {cost === null ? (
              <span className="py-2.5 text-xs text-muted">
                Working out what this costs.
              </span>
            ) : (
              <div className="flex flex-col">
                {cost.map((c) => (
                  <div
                    key={c.what}
                    className="flex gap-2.5 border-b border-rule py-2.5"
                  >
                    {/* The marker, as a rule rather than a dash character. */}
                    <span className="mt-[9px] h-px w-[11px] flex-none bg-penalty" />
                    <div className="flex flex-col gap-[3px]">
                      <span className="text-xs leading-relaxed">{c.what}</span>
                      <span className="text-micro leading-relaxed text-muted">
                        {c.detail}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error ? (
              <span className="text-2xs leading-relaxed text-penalty">{error}</span>
            ) : null}

            <span className="text-2xs leading-relaxed text-muted">
              {STOP_FOOTNOTE}
            </span>

            <div className="mt-0.5 flex flex-col gap-[9px]">
              <button
                type="button"
                // Nothing is confirmable until the list is on screen. The
                // sheet exists to be read, and a confirm that is pressable
                // before it has anything to read is the bare button again.
                disabled={cost === null || stopping}
                onClick={() =>
                  startStopping(async () => {
                    // stopTrackingAction redirects, so there is no success
                    // path back into this component.
                    try {
                      await stopTrackingAction(typeKey);
                    } catch (e) {
                      // A redirect throws by design. Anything else is real.
                      if (e && typeof e === "object" && "digest" in e) throw e;
                      setError(e instanceof Error ? e.message : "That did not work.");
                    }
                  })
                }
                className="h-[46px] w-full border border-penalty text-base text-penalty active:opacity-70 disabled:opacity-40"
              >
                {stopping ? `Stopping ${name}` : `Stop tracking ${name}`}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={stopping}
                className="h-[46px] w-full border border-rule text-base active:opacity-70 disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
