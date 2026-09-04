"use client";

import { useOptimistic } from "react";
import Link from "next/link";
import { ActivityIcon } from "../../activity-icon";
import { setShareAction } from "../../group/[groupId]/(hub)/settings/actions";
import { CheckRow, Toggle, useServerAction } from "@/app/ui";

export interface ShareRow {
  typeKey: string;
  name: string;
  icon: string;
  shared: boolean;
  /** Whether the viewer actually tracks this. An untracked type cannot be
   *  shared: there is no schedule to check in against, so the share could only
   *  ever be a miss. The server refuses it too. */
  tracked: boolean;
  shareEvidence: boolean;
  takesEvidence: boolean;
  sub: string;
}

export interface GroupShares {
  groupId: string;
  groupName: string;
  rows: ShareRow[];
}

/** One row's new state, applied before the server has agreed to it. */
type Patch = { groupId: string; typeKey: string } & Partial<
  Pick<ShareRow, "shared" | "shareEvidence">
>;

export function SharingForm({ blocks }: { blocks: GroupShares[] }) {
  const { run: runAction, error } = useServerAction();

  // The switch moves on the press, not when the round trip finishes. Before
  // this, the pending flag was discarded (`const [, startTransition]`) and the
  // toggle sat still through a server action AND a refresh, so it read as a
  // press that did nothing. React rolls the patch back on its own if the
  // action throws.
  const [view, patch] = useOptimistic(blocks, (state, p: Patch) =>
    state.map((b) =>
      b.groupId !== p.groupId
        ? b
        : {
            ...b,
            rows: b.rows.map((r) => (r.typeKey === p.typeKey ? { ...r, ...p } : r)),
          },
    ),
  );

  // useOptimistic's patch has to be applied inside a transition, and the shared
  // hook already runs `fn` inside one, so applying it first thing here is
  // exactly the right place.
  function run(next: Patch, fn: () => Promise<void>) {
    runAction(async () => {
      patch(next);
      await fn();
    });
  }

  return (
    <div className="flex flex-col gap-6 px-5 pb-6 pt-[18px]">
      {view.length === 0 ? (
        <p className="text-[13px] leading-[1.6] text-muted">
          You are not in a group, so nothing is shared anywhere.
        </p>
      ) : (
        view.map((block) => (
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
                      {row.tracked ? (
                        <Toggle
                          on={row.shared}
                          onClick={() =>
                            run(
                              { groupId: block.groupId, typeKey: row.typeKey, shared: !row.shared },
                              () =>
                                setShareAction({
                                  groupId: block.groupId,
                                  typeKey: row.typeKey,
                                  shared: !row.shared,
                                  shareEvidence: row.shareEvidence,
                                }),
                            )
                          }
                        />
                      ) : (
                        // The join screen's affordance: the way out of an
                        // untracked row is to set the activity up, not to
                        // press a switch that cannot mean anything.
                        <Link
                          href={`/activities/${row.typeKey}`}
                          className="flex-none text-[11.5px] text-accent underline underline-offset-2"
                        >
                          Set it up first
                        </Link>
                      )}
                    </div>

                    {row.shared && row.takesEvidence ? (
                      <CheckRow
                        on={row.shareEvidence}
                        className="pb-[13px] pl-[29px]"
                        onClick={() =>
                          run(
                            {
                              groupId: block.groupId,
                              typeKey: row.typeKey,
                              shareEvidence: !row.shareEvidence,
                            },
                            () =>
                              setShareAction({
                                groupId: block.groupId,
                                typeKey: row.typeKey,
                                shared: true,
                                shareEvidence: !row.shareEvidence,
                              }),
                          )
                        }
                      >
                        Share evidence with this group
                      </CheckRow>
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

      <p className="text-[11.5px] leading-[1.55] text-muted">
        Photos off leaves your streak shared. Turning an activity off keeps your
        record in that group, it just stops growing.
      </p>
    </div>
  );
}
