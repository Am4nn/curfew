"use client";

import { useState } from "react";
import { useServerAction } from "@/app/ui";
import { ActivityIcon } from "../../activity-icon";
import {
  deletePhotosAction,
  deleteOnePhotoAction,
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

export interface PhotoRow {
  id: number;
  url: string;
  typeKey: string;
  name: string;
  icon: string;
  /** Already formatted server-side, e.g. "3 Sep". */
  date: string;
}

type Pending =
  | { kind: "photos" }
  | { kind: "photo-pick" }
  | { kind: "photo"; id: number; name: string; date: string }
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
  singlePhotos,
  activities,
  outstanding,
}: {
  photos: number;
  singlePhotos: PhotoRow[];
  activities: HistoryRow[];
  /** Already formatted server-side: money never gets a hardcoded divisor. */
  outstanding: string[];
  }) {
  const [pending, setPending] = useState<Pending>(null);
  const [typed, setTyped] = useState("");
  const { run: runAction, pending: busy, error } = useServerAction();

  // The shared hook, plus what this screen does after a delete lands: step to
  // the next confirmation, and clear the typed-name box.
  function run(fn: () => Promise<void>, after: Pending = null) {
    runAction(async () => {
      await fn();
      setPending(after);
      setTyped("");
    });
  }

  const title = (p: NonNullable<Pending>) => {
    if (p.kind === "account") return "Delete your account?";
    if (p.kind === "photo") return `Delete this ${p.name} photo from ${p.date}?`;
    return "Delete this?";
  };

  const confirmText = (p: NonNullable<Pending>) => {
    if (p.kind === "photos") {
      return `${photos} ${photos === 1 ? "photo goes" : "photos go"} from storage within minutes. Your check-ins, streaks and standing are unaffected.`;
    }
    if (p.kind === "photo") {
      return "This cannot be undone. The photo goes from storage within minutes. The check-in stays as an anonymous count.";
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
            label="Delete a single photo"
            onClick={() => setPending({ kind: "photo-pick" })}
          />
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

      {/* The money warning keeps its colour, because it is the one thing here
          that survives the deletion. The rest is plain text: three stacked
          boxes on one screen is what made this page shout. */}
      <p className="text-[11.5px] leading-[1.55] text-penalty">
        Money owed is never deleted.
        {outstanding.length > 0 ? ` You owe ${outstanding.join(", ")}.` : ""} Ledger
        entries stay, with your name removed where it can be.
      </p>

      <p className="text-[11.5px] leading-[1.55] text-muted">
        Photos go within minutes. Habit history goes with them. Nothing here can be
        undone.
      </p>

      {pending && (pending.kind === "photo-pick" || pending.kind === "photo") ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-bg">
          <header className="flex items-center gap-[9px] border-b border-rule px-5 pb-[11px] pt-5">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="text-[14px] text-muted"
            >
              &lsaquo;
            </button>
            <span className="text-[14px] font-semibold tracking-[0.14em]">
              DELETE A PHOTO
            </span>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-[18px]">
            {singlePhotos.length === 0 ? (
              <p className="text-[12.5px] leading-[1.6] text-muted">You have no photos.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {singlePhotos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setPending({ kind: "photo", id: p.id, name: p.name, date: p.date })
                    }
                    className="flex flex-col gap-[6px] text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`${p.name}, ${p.date}`}
                      className="aspect-square w-full border border-rule bg-surface object-cover"
                    />
                    <span className="flex items-center gap-[5px] text-[10px] text-muted">
                      <ActivityIcon name={p.icon} size={11} />
                      {p.name}
                    </span>
                    <span className="text-[10px] text-muted">{p.date}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {pending && pending.kind !== "photo-pick" ? (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: "var(--scrim-85)" }}
        >
          <div className="flex w-full flex-col gap-3 border-t border-penalty bg-bg px-5 pb-5 pt-5">
            <span className="text-[16px] font-semibold">{title(pending)}</span>
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
                  setPending(pending.kind === "photo" ? { kind: "photo-pick" } : null);
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
                    if (pending.kind === "photo") return deleteOnePhotoAction(pending.id);
                    if (pending.kind === "activity")
                      return deleteActivityHistoryAction(pending.typeKey);
                    if (pending.kind === "history") return deleteAllHistoryAction();
                    return deleteAccountAction();
                  }, pending.kind === "photo" ? { kind: "photo-pick" } : null)
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
