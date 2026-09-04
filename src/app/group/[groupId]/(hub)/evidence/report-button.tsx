"use client";

import { useState } from "react";
import { useServerAction } from "@/app/ui";
import { REPORT_REASONS, type ReportReason } from "@/lib/report-reasons";
import { reportEvidenceAction } from "./actions";

// Reporting a photo. Deliberately quiet: a small control on the item rather
// than a button competing with the picture, because most photos are fine and
// the app is not a moderation queue.
export function ReportButton({
  evidenceId,
  groupId,
  who,
}: {
  evidenceId: number;
  groupId: string;
  who: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("nsfw");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const { run, pending: busy, error } = useServerAction();

  if (done) {
    return <span className="text-[10px] text-muted">reported</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Report the photo from ${who}`}
        className="text-[10px] text-muted underline underline-offset-2"
      >
        report
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: "var(--scrim-85)" }}
        >
          <div className="flex w-full flex-col gap-3 border-t border-penalty bg-bg px-5 pb-5 pt-5">
            <span className="text-[16px] font-semibold">Report this photo</span>
            <span className="text-[12px] leading-[1.6] text-muted">
              An admin will look at it. That is the only reason an admin ever sees a
              photo, and the fact they looked is recorded.
            </span>

            <div className="flex flex-col">
              {(Object.keys(REPORT_REASONS) as ReportReason[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setReason(key)}
                  className="flex items-center gap-[9px] border-b border-rule py-[11px] text-left"
                >
                  <span
                    className={
                      "h-4 w-4 flex-none border " +
                      (reason === key ? "border-fg bg-fg" : "border-rule")
                    }
                  />
                  <span className="text-[12.5px]">{REPORT_REASONS[key]}</span>
                </button>
              ))}
            </div>

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Anything to add (optional)"
              aria-label="Anything to add"
              className="border border-rule bg-transparent px-3 py-[11px] text-[13px] text-fg outline-none placeholder:text-muted"
            />

            {error ? (
              <span className="text-[11.5px] leading-[1.55] text-penalty">{error}</span>
            ) : null}

            <div className="flex gap-[10px]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-[46px] flex-1 border border-rule text-[13.5px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await reportEvidenceAction({ evidenceId, groupId, reason, note });
                    setOpen(false);
                    setDone(true);
                  })
                }
                className="h-[46px] flex-1 border border-penalty bg-penalty text-[13.5px] font-semibold text-bg active:opacity-70 disabled:opacity-40"
              >
                {busy ? "Sending" : "Report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
