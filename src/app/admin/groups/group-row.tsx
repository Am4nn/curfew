"use client";

import Link from "next/link";
import { useServerAction } from "@/app/ui";
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
  moneyLabel,
  canWrite,
  canArchive,
}: {
  group: {
    groupId: string;
    name: string;
    memberCount: number;
    typeCount: number;
    ownerName: string | null;
    archived: boolean;
  };
  override: MoneyOverride;
  moneyLabel: string | null;
  canWrite: boolean;
  canArchive: boolean;
}) {
  const { run, pending, error } = useServerAction();

  return (
    <div className="flex flex-col gap-[10px] border-b border-rule py-[14px]">
      <div className="flex items-baseline gap-2">
        <Link href={`/admin/groups/${group.groupId}`} className="flex-1 text-[14px]">
          {group.name} &rsaquo;
        </Link>
        {group.archived ? (
          <span className="border border-rule px-[6px] py-px text-[9.5px] tracking-[0.1em] text-muted">
            ARCHIVED
          </span>
        ) : canArchive ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setArchivedAction(group.groupId, true))}
            className="flex-none text-[11px] text-muted active:opacity-70 disabled:opacity-40"
          >
            {pending ? "Archiving" : "Archive"}
          </button>
        ) : null}
      </div>

      <span className="text-[11px] text-muted">
        {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
        {" · "}
        {group.typeCount} {group.typeCount === 1 ? "type" : "types"}
        {group.ownerName ? ` · owner ${group.ownerName}` : ""}
      </span>

      {/* Archived groups are frozen and show no money control here (mock:
          .design/V3AdminGroups.dc.html row 4). Restoring is still possible
          from the group's own inspector page, which is not this list. */}
      {!group.archived ? (
        <div className="flex flex-wrap items-center gap-[6px]">
          {moneyLabel ? <span className="mr-1 text-[11px] text-muted">{moneyLabel}</span> : null}
          {OPTIONS.map((option) => {
            const active = override === option.value;
            return (
              <button
                key={String(option.value)}
                type="button"
                title={option.hint}
                disabled={!canWrite || pending || active}
                onClick={() => run(() => setMoneyOverrideAction(group.groupId, option.value))}
                className={
                  // The active chip is disabled because it is already the
                  // current value, which is not the same as unavailable, so it
                  // keeps full opacity. Every other disabled state fades.
                  "h-[30px] border px-[10px] text-[11.5px] active:opacity-70 " +
                  (active
                    ? "border-fg bg-fg font-semibold text-bg disabled:opacity-100"
                    : "border-rule text-muted disabled:opacity-40")
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Both actions here used to swallow their failure entirely. */}
      {error ? <span className="text-[11px] text-penalty">{error}</span> : null}
    </div>
  );
}
