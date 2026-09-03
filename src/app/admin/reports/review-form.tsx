"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewReportAction, banUserAction } from "./actions";

// Deciding a report. Removing a photo and removing a person are separate acts
// on purpose: taking down one bad picture should never quietly take down
// somebody's account with it.
export function ReviewForm({
  reportId,
  subjectId,
  subjectName,
  hasPhoto,
}: {
  reportId: number;
  subjectId: string;
  subjectName: string;
  hasPhoto: boolean;
}) {
  const router = useRouter();
  const [banning, setBanning] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not go through.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <span className="text-[11.5px] text-penalty">{error}</span> : null}

      <div className="flex flex-wrap gap-[10px]">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(() =>
              reviewReportAction({ reportId, outcome: "dismissed", removePhoto: false }),
            )
          }
          className="h-[38px] flex-1 border border-rule px-3 text-[12.5px] disabled:opacity-50"
        >
          Nothing wrong with it
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(() =>
              reviewReportAction({ reportId, outcome: "upheld", removePhoto: hasPhoto }),
            )
          }
          className="h-[38px] flex-1 border border-penalty bg-penalty px-3 text-[12.5px] font-semibold text-bg disabled:opacity-50"
        >
          {hasPhoto ? "Remove the photo" : "Uphold"}
        </button>
      </div>

      {banning ? (
        <div className="flex flex-col gap-2 border-t border-rule pt-3">
          <span className="text-[12px] text-muted">
            Banning {subjectName} deletes their photos and blocks sign-in. Money they
            owe stays owed and stays visible. A ban is not a way to clear a debt.
          </span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="Reason, recorded against the ban"
            aria-label="Reason for the ban"
            className="border border-rule bg-transparent px-3 py-[9px] text-[13px] text-fg outline-none placeholder:text-muted"
          />
          <div className="flex gap-[10px]">
            <button
              type="button"
              onClick={() => setBanning(false)}
              className="h-[38px] flex-1 border border-rule text-[12.5px]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || reason.trim().length === 0}
              onClick={() =>
                run(async () => {
                  await banUserAction({ userId: subjectId, reason });
                  await reviewReportAction({
                    reportId,
                    outcome: "upheld",
                    removePhoto: hasPhoto,
                  });
                })
              }
              className="h-[38px] flex-1 border border-penalty bg-penalty text-[12.5px] font-semibold text-bg disabled:opacity-50"
            >
              Ban {subjectName}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setBanning(true)}
          className="self-start text-[11.5px] text-penalty underline underline-offset-2"
        >
          Ban this account
        </button>
      )}
    </div>
  );
}
