"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActivityIcon } from "../../activity-icon";
import { setShareAction } from "../../group/[groupId]/settings/actions";

export interface ShareRow {
  typeKey: string;
  name: string;
  icon: string;
  shared: boolean;
  shareEvidence: boolean;
  takesEvidence: boolean;
  sub: string;
}

export interface GroupShares {
  groupId: string;
  groupName: string;
  rows: ShareRow[];
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

export function SharingForm({ blocks }: { blocks: GroupShares[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
      {blocks.length === 0 ? (
        <p className="text-[13px] leading-[1.6] text-muted">
          You are not in a group, so nothing is shared anywhere.
        </p>
      ) : (
        blocks.map((block) => (
          <section key={block.groupId} className="flex flex-col gap-[10px]">
            <span className="text-[10px] tracking-[0.16em] text-muted">
              {block.groupName.toUpperCase()}
            </span>
            {block.rows.length === 0 ? (
              <p className="text-[12px] text-muted">This group accepts nothing yet.</p>
            ) : (
              <div className="flex flex-col">
                {block.rows.map((row) => (
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
                              groupId: block.groupId,
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
                              groupId: block.groupId,
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
          </section>
        ))
      )}

      {error ? (
        <div className="border-l-[3px] border-l-penalty bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] text-penalty">
          {error}
        </div>
      ) : null}

      <div className="border-l-[3px] border-l-muted bg-surface px-[13px] py-[11px] text-[11.5px] leading-[1.55] text-muted">
        Photos off leaves your streak shared. Turning an activity off keeps your
        record in that group, it just stops growing.
      </div>
    </div>
  );
}
