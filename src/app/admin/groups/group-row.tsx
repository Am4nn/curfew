"use client";

import Link from "next/link";
import { useTransition } from "react";
import { formatMoney } from "@/domain";
import type { MoneyOverride } from "@/server/group-controls";
import { setMoneyOverrideAction, setArchivedAction } from "./actions";

// One group in the admin directory. Money can be switched on here for a single
// group even when it is off everywhere else (decision 66), and a group is
// archived rather than deleted (decision 67).
//
// These are the two admin actions that take effect immediately rather than
// going through the Controls save sheet: they are per-group and reversible, and
// the sheet exists for changes that affect everyone at once.

const OPTIONS: { value: MoneyOverride; label: string; hint: string }[] = [
  { value: null, label: "Follow app", hint: "Whatever money is set to app-wide." },
  { value: true, label: "On", hint: "Money for this group even if it is off app-wide." },
  { value: false, label: "Off", hint: "No money here whatever the app-wide setting." },
];

export function GroupRow({
  group,
  override,
  canWrite,
  canArchive,
}: {
  group: {
    groupId: string;
    name: string;
    memberCount: number;
    totalFined: number;
    archived: boolean;
  };
  override: MoneyOverride;
  canWrite: boolean;
  canArchive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-[10px] border-b border-rule py-[14px]">
      <div className="flex items-baseline gap-2">
        <Link href={`/admin/groups/${group.groupId}`} className="text-[14px]">
          {group.name} &rsaquo;
        </Link>
        {group.archived ? (
          <span className="border border-rule px-[6px] py-px text-[9.5px] tracking-[0.1em] text-muted">
            ARCHIVED
          </span>
        ) : null}
      </div>

      <span className="text-[11px] text-muted">
        {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
        {" · "}
        {formatMoney(group.totalFined, "INR")} fined
      </span>

      <div className="flex flex-wrap items-center gap-[6px]">
        <span className="mr-1 text-[11px] text-muted">Money</span>
        {OPTIONS.map((option) => {
          const active = override === option.value;
          return (
            <button
              key={String(option.value)}
              type="button"
              title={option.hint}
              disabled={!canWrite || pending || active}
              onClick={() =>
                startTransition(async () => {
                  await setMoneyOverrideAction(group.groupId, option.value);
                })
              }
              className={
                "h-[30px] border px-[10px] text-[11.5px] disabled:opacity-100 " +
                (active
                  ? "border-fg bg-fg font-semibold text-bg"
                  : "border-rule text-muted disabled:opacity-40")
              }
            >
              {option.label}
            </button>
          );
        })}

        {canArchive ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await setArchivedAction(group.groupId, !group.archived);
              })
            }
            className="ml-auto h-[30px] border border-rule px-[10px] text-[11.5px] text-muted disabled:opacity-40"
          >
            {group.archived ? "Restore" : "Archive"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
