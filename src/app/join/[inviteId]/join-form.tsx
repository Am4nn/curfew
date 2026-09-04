"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ceilingFor, rankFor, START_SCORE } from "@/domain";
import { ActivityIcon } from "../../activity-icon";
import { RANK_TEXT } from "../../rank-icon";
import { joinAction, declineAction } from "./actions";
import { SubmitButton, Toggle } from "@/app/ui";

export interface JoinRow {
  typeKey: string;
  name: string;
  icon: string;
  /** Whether the person already tracks this at all. */
  tracked: boolean;
  takesEvidence: boolean;
  sub: string;
}

export function JoinForm({
  inviteId,
  groupId,
  groupName,
  rows,
}: {
  inviteId: string;
  groupId: string;
  groupName: string;
  rows: JoinRow[];
}) {
  const [state, setState] = useState(() =>
    Object.fromEntries(
      rows.map((r) => [r.typeKey, { shared: r.tracked, shareEvidence: false }]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const sharing = rows.filter((r) => state[r.typeKey]?.shared).length;
  const ceiling = rows.length === 0 ? 1000 : ceilingFor(sharing / rows.length);
  const startRank = rankFor(START_SCORE);

  function join() {
    setError(null);
    startTransition(async () => {
      try {
        await joinAction({
          inviteId,
          groupId,
          shares: rows.map((r) => ({ typeKey: r.typeKey, ...state[r.typeKey] })),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not join.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-[18px] px-5 pb-6 pt-[18px]">
      <p className="text-[12.5px] leading-[1.6] text-muted">
        {groupName} tracks {rows.length}{" "}
        {rows.length === 1 ? "activity" : "activities"}. Choose what you send them.
        You can change this any time.
      </p>

      <div className="flex flex-col">
        {rows.map((row) => {
          const mine = state[row.typeKey];
          return (
            <div key={row.typeKey} className="flex flex-col border-b border-rule">
              <div
                className={
                  "flex items-center gap-[11px] pt-[13px] " +
                  (row.tracked && mine.shared && row.takesEvidence ? "pb-[9px]" : "pb-[13px]")
                }
              >
                <span className={"flex flex-none " + (mine.shared ? "text-fg" : "text-muted")}>
                  <ActivityIcon name={row.icon} />
                </span>
                <div className="flex flex-1 flex-col gap-[3px]">
                  <span className="text-[13.5px]">{row.name}</span>
                  <span className="text-[11px] text-muted">{row.sub}</span>
                </div>
                <Toggle
                  on={mine.shared}
                  disabled={!row.tracked}
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      [row.typeKey]: { ...s[row.typeKey], shared: !s[row.typeKey].shared },
                    }))
                  }
                />
              </div>

              {/* An activity becomes yours either way, group or no group. Only
                  then can it be shared. */}
              {!row.tracked ? (
                <div className="pb-[13px] pl-[29px]">
                  <Link
                    href={`/activities/${row.typeKey}?from=join&invite=${inviteId}`}
                    className="inline-flex h-8 items-center border border-rule px-3 text-[12px]"
                  >
                    Set it up first
                  </Link>
                </div>
              ) : mine.shared && row.takesEvidence ? (
                <button
                  type="button"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      [row.typeKey]: {
                        ...s[row.typeKey],
                        shareEvidence: !s[row.typeKey].shareEvidence,
                      },
                    }))
                  }
                  className="flex items-center gap-[9px] pb-[13px] pl-[29px]"
                >
                  <span
                    className={
                      "flex h-4 w-4 flex-none items-center justify-center border " +
                      (mine.shareEvidence ? "border-fg bg-fg" : "border-rule")
                    }
                  >
                    {mine.shareEvidence ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3">
                        <path d="M4 12.5 9 17.5 20 6.5" />
                      </svg>
                    ) : null}
                  </span>
                  <span className={"text-[12px] " + (mine.shareEvidence ? "text-fg" : "text-muted")}>
                    Share evidence with this group
                  </span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-[7px] border border-rule p-[13px]">
        <span className="text-[12.5px]">
          {rows.length === 0
            ? "This group accepts nothing yet, so nothing caps you."
            : `Sharing ${sharing} of ${rows.length} caps your score at ${Math.round(ceiling)}.`}
        </span>
        <span className="text-[11px] leading-[1.55] text-muted">
          You start at {START_SCORE},{" "}
          <span className={RANK_TEXT[startRank.key]}>{startRank.name}</span>.
        </span>
      </div>

      {error ? (
        <div className="text-[11.5px] leading-[1.55] text-penalty">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={join}
        disabled={busy}
        className="h-11 w-full border border-fg bg-fg text-[14px] font-semibold text-bg disabled:opacity-50"
      >
        {busy ? "Joining" : "Join group"}
      </button>

      <form action={declineAction.bind(null, inviteId)}>
        <SubmitButton
          className="h-11 w-full border border-rule text-[14px] text-muted"
          pendingLabel="Declining"
        >
          Decline
        </SubmitButton>
      </form>
    </div>
  );
}
