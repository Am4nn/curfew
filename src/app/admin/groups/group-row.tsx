"use client";

import Link from "next/link";
import { useServerAction } from "@/app/ui";
import type { MoneyOverride } from "@/server/group-controls";
import { setMoneyOverrideAction } from "./actions";

// One group in the admin directory. Money can be switched on here for a single
// group even when it is off everywhere else (decision 66). It takes effect
// immediately rather than going through the Controls save sheet: it is
// per-group and reversible, and the sheet exists for changes that affect
// everyone at once.
//
// Archiving is NOT here. It was on this row and again on the group's own page,
// and one of the two had to go: a list is where you scan, and a control that
// freezes a whole group sitting a thumb's width from the name of the group
// below it is the wrong place to put it. The badge stays, because that is
// status rather than a control.

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
}) {
  const { run, pending, error } = useServerAction();

  return (
    <div className="flex flex-col gap-2.5 border-b border-rule py-3.5">
      <div className="flex items-baseline gap-2">
        <Link href={`/admin/groups/${group.groupId}`} className="flex-1 text-base">
          {group.name} &rsaquo;
        </Link>
        {group.archived ? (
          <span className="border border-rule px-1.5 py-px text-micro tracking-wider text-muted">
            ARCHIVED
          </span>
        ) : null}
      </div>

      <span className="text-2xs text-muted">
        {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
        {" · "}
        {group.typeCount} {group.typeCount === 1 ? "type" : "types"}
        {group.ownerName ? ` · owner ${group.ownerName}` : ""}
      </span>

      {/* Archived groups are frozen and show no money control here (mock:
          .design/V3AdminGroups.dc.html row 4). Restoring is still possible
          from the group's own inspector page, which is not this list. */}
      {!group.archived ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {moneyLabel ? <span className="mr-1 text-2xs text-muted">{moneyLabel}</span> : null}
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
                  "h-[30px] border px-2.5 text-2xs active:opacity-70 " +
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

      {/* This used to swallow its failure entirely. */}
      {error ? <span className="text-2xs text-penalty">{error}</span> : null}
    </div>
  );
}
