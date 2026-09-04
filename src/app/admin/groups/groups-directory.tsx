"use client";

import { useMemo, useState } from "react";
import type { AdminGroupRow } from "@/server/admin";
import type { MoneyOverride } from "@/server/group-controls";
import { GroupRow } from "./group-row";

// Search, filters and the app-wide-money-off note for
// .design/V3AdminGroups.dc.html. Client-side for the same reason as the users
// directory: this is an admin's own group list, not a table built to page
// through.

export interface GroupDirectoryRow {
  group: AdminGroupRow;
  override: MoneyOverride;
  moneyOn: boolean;
  moneyLabel: string | null;
}

const FILTERS = ["All", "Active", "Money on", "Archived"] as const;
type Filter = (typeof FILTERS)[number];

export function GroupsDirectory({
  rows,
  appWideMoneyOn,
  canWrite,
  canArchive,
}: {
  rows: GroupDirectoryRow[];
  appWideMoneyOn: boolean;
  canWrite: boolean;
  canArchive: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "Active" && r.group.archived) return false;
      if (filter === "Archived" && !r.group.archived) return false;
      if (filter === "Money on" && !r.moneyOn) return false;
      if (!q) return true;
      return r.group.name.toLowerCase().includes(q);
    });
  }, [rows, query, filter]);

  return (
    <>
      <div className="flex items-center gap-[10px] border border-rule px-3 py-[10px]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-none text-muted">
          <circle cx="11" cy="11" r="7"></circle>
          <path d="M16.5 16.5 21 21"></path>
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search groups"
          className="w-full bg-transparent text-[13.5px] text-fg placeholder:text-muted outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-[7px]">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              "border px-[11px] py-[6px] text-[11.5px] " +
              (filter === f ? "border-fg bg-fg text-bg" : "border-rule text-muted")
            }
          >
            {f}
          </button>
        ))}
      </div>

      {!appWideMoneyOn ? (
        <div className="text-[11.5px] leading-[1.55] text-muted">
          Money is off app-wide. A group switched on here keeps it, and its members still
          see everything about money.
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-4 text-[13px] text-muted">No groups match.</p>
      ) : (
        <div className="flex flex-col">
          {filtered.map((r) => (
            <GroupRow
              key={r.group.groupId}
              group={r.group}
              override={r.override}
              moneyLabel={r.moneyLabel}
              canWrite={canWrite}
              canArchive={canArchive}
            />
          ))}
        </div>
      )}
    </>
  );
}
