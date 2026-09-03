"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, minorUnitExponent } from "@/domain";
import { ActivityIcon } from "../../../activity-icon";
import {
  setShareAction,
  setAcceptedAction,
  setMoneyAction,
  setFineAction,
  leaveGroupAction,
} from "./actions";

// One toggle for the activity, and a checkbox for its photos underneath. Only
// two, deliberately (decision 16): anything finer becomes a settings screen
// nobody understands.

export interface ShareRow {
  typeKey: string;
  name: string;
  icon: string;
  accepted: boolean;
  shared: boolean;
  shareEvidence: boolean;
  takesEvidence: boolean;
  /** "18 day streak", or why it is not shared. */
  sub: string;
}

export interface AcceptedRow {
  typeKey: string;
  name: string;
  icon: string;
  sharers: number;
  fineAmount: number;
  currency: string;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={
        "flex h-[22px] w-10 flex-none items-center p-[2px] " +
        (on ? "justify-end border border-fg bg-fg" : "justify-start border border-rule")
      }
    >
      <span className={"h-4 w-4 " + (on ? "bg-bg" : "bg-muted")} />
    </button>
  );
}

export function SettingsForm({
  groupId,
  isOwner,
  moneyOn,
  appMoneyOn,
  shares,
  accepted,
  addable,
}: {
  groupId: string;
  isOwner: boolean;
  moneyOn: boolean;
  appMoneyOn: boolean;
  shares: ShareRow[];
  accepted: AcceptedRow[];
  addable: { typeKey: string; name: string; icon: string }[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not save.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 px-5 pb-6 pt-[18px]">
      <section className="flex flex-col gap-[10px]">
        <span className="text-[10px] tracking-[0.16em] text-muted">WHAT YOU SHARE</span>
        {shares.length === 0 ? (
          <p className="text-[12.5px] leading-[1.6] text-muted">
            This group accepts nothing yet, so there is nothing to share.
          </p>
        ) : (
          <div className="flex flex-col">
            {shares.map((row) => (
              <div key={row.typeKey} className="flex flex-col border-b border-rule">
                <div
                  className={
                    "flex items-center gap-[11px] pt-[13px] " +
                    (row.shared && row.takesEvidence ? "pb-[9px]" : "pb-[13px]")
                  }
                >
                  <span className={"flex flex-none " + (row.shared ? "text-fg" : "text-muted")}>
                    <ActivityIcon name={row.icon} />
                  </span>
                  <div className="flex flex-1 flex-col gap-[3px]">
                    <span className="text-[13.5px]">{row.name}</span>
                    <span className="text-[11px] text-muted">{row.sub}</span>
                  </div>
                  <Toggle
                    on={row.shared}
                    onClick={() =>
                      run(() =>
                        setShareAction({
                          groupId,
                          typeKey: row.typeKey,
                          shared: !row.shared,
                          shareEvidence: row.shareEvidence,
                        }),
                      )
                    }
                  />
                </div>

                {row.shared && row.takesEvidence ? (
                  <button
                    type="button"
                    onClick={() =>
                      run(() =>
                        setShareAction({
                          groupId,
                          typeKey: row.typeKey,
                          shared: true,
                          shareEvidence: !row.shareEvidence,
                        }),
                      )
                    }
                    className="flex items-center gap-[9px] pb-[13px] pl-[29px]"
                  >
                    <span
                      className={
                        "flex h-4 w-4 flex-none items-center justify-center border " +
                        (row.shareEvidence ? "border-fg bg-fg" : "border-rule")
                      }
                    >
                      {row.shareEvidence ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3">
                          <path d="M4 12.5 9 17.5 20 6.5" />
                        </svg>
                      ) : null}
                    </span>
                    <span
                      className={"text-[12px] " + (row.shareEvidence ? "text-fg" : "text-muted")}
                    >
                      Share evidence with this group
                    </span>
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <span className="text-[11.5px] leading-[1.55] text-muted">
          Sharing more of what the group accepts raises your ceiling. Stopping does not
          erase your record here, it settles to the lower ceiling.
        </span>
      </section>

      {isOwner ? (
        <section className="flex flex-col gap-[10px]">
          <span className="text-[10px] tracking-[0.16em] text-muted">
            ACCEPTED ACTIVITIES &middot; OWNER
          </span>
          <div className="flex flex-col">
            {accepted.map((row) => (
              <div key={row.typeKey} className="flex items-center gap-[11px] border-b border-rule py-3">
                <span className="flex flex-none">
                  <ActivityIcon name={row.icon} />
                </span>
                <div className="flex flex-1 flex-col gap-[3px]">
                  <span className="text-[13.5px]">{row.name}</span>
                  <span className="text-[11px] text-muted">
                    {row.sharers} {row.sharers === 1 ? "member shares" : "members share"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    run(() =>
                      setAcceptedAction({ groupId, typeKey: row.typeKey, accepted: false }),
                    )
                  }
                  className="flex-none text-[11.5px] text-penalty"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {adding ? (
            <div className="flex flex-col">
              {addable.map((t) => (
                <button
                  key={t.typeKey}
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    run(() =>
                      setAcceptedAction({ groupId, typeKey: t.typeKey, accepted: true }),
                    );
                  }}
                  className="flex items-center gap-[11px] border-b border-rule py-3 text-left"
                >
                  <ActivityIcon name={t.icon} />
                  <span className="flex-1 text-[13.5px]">{t.name}</span>
                  <span className="text-[11.5px] text-muted">Accept</span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              disabled={addable.length === 0}
              onClick={() => setAdding(true)}
              className="h-11 w-full border border-rule text-[14px] disabled:opacity-40"
            >
              + Accept another activity
            </button>
          )}
        </section>
      ) : null}

      {/* Money is hidden entirely where the app has it off: a user whose groups
          all have money off never sees money at all (decision 43). */}
      {isOwner && appMoneyOn ? (
        <section className="flex flex-col gap-[10px]">
          <span className="text-[10px] tracking-[0.16em] text-muted">MONEY &middot; OWNER</span>
          <div className="flex items-center gap-[11px] border-b border-rule py-3">
            <div className="flex flex-1 flex-col gap-[3px]">
              <span className="text-[13.5px]">Track money</span>
              <span className="text-[11px] leading-[1.5] text-muted">
                Fines are owed between members, never collected by Curfew
              </span>
            </div>
            <Toggle
              on={moneyOn}
              onClick={() => run(() => setMoneyAction({ groupId, on: !moneyOn }))}
            />
          </div>

          {moneyOn
            ? accepted.map((row) => (
                <FineRow
                  key={row.typeKey}
                  row={row}
                  onSave={(amount) =>
                    run(() =>
                      setFineAction({
                        groupId,
                        typeKey: row.typeKey,
                        amount,
                        currency: row.currency,
                      }),
                    )
                  }
                />
              ))
            : null}
          {moneyOn ? (
            <span className="text-[11.5px] leading-[1.55] text-muted">
              A fine change takes effect from tomorrow, so it cannot rewrite a period
              already running.
            </span>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <div className="border-l-[3px] border-l-penalty bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] text-penalty">
          {error}
        </div>
      ) : null}

      <form action={leaveGroupAction.bind(null, groupId)}>
        <button
          type="submit"
          disabled={busy}
          className="h-11 w-full border border-rule text-[14px] text-penalty disabled:opacity-40"
        >
          Leave group
        </button>
      </form>
      <span className="text-[11px] leading-[1.55] text-muted">
        Leaving keeps what you owe and what you are owed. Your streaks, standing and
        photos stop being visible here at once.
      </span>
    </div>
  );
}

function FineRow({
  row,
  onSave,
}: {
  row: AcceptedRow;
  onSave: (amount: number) => void;
}) {
  const exponent = minorUnitExponent(row.currency);
  const [value, setValue] = useState(
    row.fineAmount > 0 ? String(row.fineAmount / 10 ** exponent) : "",
  );

  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule py-[11px]">
      <span className="text-[13px]">{row.name}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          placeholder="no fine"
          aria-label={`${row.name} fine`}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            const n = Number(value);
            if (value !== "" && Number.isFinite(n)) onSave(n);
          }}
          className="w-24 border border-rule bg-transparent px-2 py-[6px] text-right text-[12.5px] tabular-nums text-fg outline-none placeholder:text-muted"
        />
        <span className="text-[11px] text-muted">
          {row.fineAmount > 0 ? formatMoney(row.fineAmount, row.currency) : row.currency}
        </span>
      </div>
    </div>
  );
}
