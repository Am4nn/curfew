"use client";

import { useState, useTransition } from "react";
import { ActivityIcon } from "../../activity-icon";
import {
  deletePhotosAction,
  deleteActivityHistoryAction,
  deleteAllHistoryAction,
  deleteAccountAction,
} from "./actions";

// Nothing here can be undone, so nothing here happens on one press. Every row
// asks again, naming what goes and what stays, and the account row asks the
// person to type the word.

export interface HistoryRow {
  typeKey: string;
  name: string;
  icon: string;
}

type Pending =
  | { kind: "photos" }
  | { kind: "activity"; typeKey: string; name: string }
  | { kind: "history" }
  | { kind: "account" }
  | null;

function Row({
  label,
  sub,
  danger,
  onClick,
}: {
  label: string;
  sub?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 border-b border-rule py-[13px] text-left"
    >
      <span className={"flex-1 text-[13.5px] " + (danger ? "text-penalty" : "")}>
        {label}
      </span>
      {sub ? <span className="text-[11px] text-muted">{sub}</span> : null}
      <span className="text-[13px] text-muted">&rsaquo;</span>
    </button>
  );
}

export function DeleteForm({
  photos,
  activities,
  outstanding,
}: {
  photos: number;
  activities: HistoryRow[];
  /** Already formatted server-side: money never gets a hardcoded divisor. */
  outstanding: string[];
  }) {
  const [pending, setPending] = useState<Pending>(null);
  const [typed, setTyped] = useState("");
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setPending(null);
        setTyped("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not go through.");
      }
    });
  }

  const confirmText = (p: NonNullable<Pending>) => {
    if (p.kind === "photos") {
      return `${photos} ${photos === 1 ? "photo goes" : "photos go"} from storage within minutes. Your check-ins, streaks and standing are unaffected.`;
    }
    if (p.kind === "activity") {
      return `Every scored period of ${p.name} goes, along with its photos. The check-ins stay as anonymous counts. Any fine already charged stays owed.`;
    }
    if (p.kind === "history") {
      return "Every scored period of every activity goes, along with every photo. Your check-ins stay as anonymous counts, and every fine already charged stays owed.";
    }
    return "Your habit history and photos go. Your name and email are removed. Ledger rows stay, because a debt with no counterparty is not a debt, and you cannot sign in again.";
  };

  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-[18px]">
      <section className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.16em] text-muted">PHOTOS</span>
        <div className="flex flex-col">
          <Row
            label="Delete all photos"
            sub={`${photos} stored`}
            onClick={() => setPending({ kind: "photos" })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.16em] text-muted">HISTORY</span>
        <div className="flex flex-col">
          {activities.map((a) => (
            <button
              key={a.typeKey}
              type="button"
              onClick={() =>
                setPending({ kind: "activity", typeKey: a.typeKey, name: a.name })
              }
              className="flex items-center gap-3 border-b border-rule py-[13px] text-left"
            >
              <span className="flex flex-none text-muted">
                <ActivityIcon name={a.icon} size={17} />
              </span>
              <span className="flex-1 text-[13.5px]">Delete {a.name} history</span>
              <span className="text-[13px] text-muted">&rsaquo;</span>
            </button>
          ))}
          <Row
            label="Delete all habit history"
            onClick={() => setPending({ kind: "history" })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.16em] text-muted">ACCOUNT</span>
        <div className="flex flex-col">
          <Row label="Delete my account" danger onClick={() => setPending({ kind: "account" })} />
        </div>
      </section>

      {outstanding.length > 0 ? (
        <div className="border-l-[3px] border-l-penalty bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] text-penalty">
          Money owed is never deleted. You owe{" "}
          {outstanding.join(", ")}. Ledger entries stay, with your name removed
          where it can be.
        </div>
      ) : (
        <div className="border-l-[3px] border-l-penalty bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] text-penalty">
          Money owed is never deleted. Ledger entries stay, with your name removed
          where it can be.
        </div>
      )}

      <div className="border-l-[3px] border-l-muted bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] text-muted">
        Photos go within minutes. Habit history goes with them. Nothing here can be
        undone.
      </div>

      {pending ? (
        <div className="fixed inset-0 z-50 flex items-end bg-bg/85">
          <div className="flex w-full flex-col gap-3 border-t border-penalty bg-bg px-5 pb-5 pt-5">
            <span className="text-[16px] font-semibold">
              {pending.kind === "account" ? "Delete your account?" : "Delete this?"}
            </span>
            <span className="text-[12px] leading-[1.6] text-muted">
              {confirmText(pending)}
            </span>

            {pending.kind === "account" ? (
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Type DELETE to confirm"
                aria-label="Type DELETE to confirm"
                className="border border-rule bg-transparent px-3 py-[11px] text-[14px] text-fg outline-none placeholder:text-muted"
              />
            ) : null}

            {error ? (
              <span className="text-[11.5px] leading-[1.55] text-penalty">{error}</span>
            ) : null}

            <div className="flex gap-[10px]">
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setTyped("");
                }}
                className="h-[46px] flex-1 border border-rule text-[13.5px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || (pending.kind === "account" && typed !== "DELETE")}
                onClick={() =>
                  run(() => {
                    if (pending.kind === "photos") return deletePhotosAction();
                    if (pending.kind === "activity")
                      return deleteActivityHistoryAction(pending.typeKey);
                    if (pending.kind === "history") return deleteAllHistoryAction();
                    return deleteAccountAction();
                  })
                }
                className="h-[46px] flex-1 border border-penalty bg-penalty text-[13.5px] font-semibold text-bg disabled:opacity-50"
              >
                {busy ? "Deleting" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
