"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdminUserRow } from "@/server/admin";

// Card list, search and filters for .design/V3AdminUsers.dc.html. Client-side:
// the admin user directory is not the kind of table that grows into the
// thousands, so filtering the list already fetched beats a round trip per
// keystroke.

const FILTERS = ["All", "Active", "Pending", "Banned"] as const;
type Filter = (typeof FILTERS)[number];

function formatInvited(requestedAt: Date | string | null): string {
  if (!requestedAt) return "invited";
  const d = new Date(requestedAt);
  return `invited ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

function metaLine(u: AdminUserRow): string {
  if (u.displayStatus === "pending") {
    return `${u.email} · ${formatInvited(u.requestedAt)}`;
  }
  const groups = `${u.groupCount} ${u.groupCount === 1 ? "group" : "groups"}`;
  const activities = `${u.activityCount} ${u.activityCount === 1 ? "activity" : "activities"}`;
  return `${u.email} · ${groups} · ${activities}`;
}

export function UsersDirectory({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter !== "All" && u.displayStatus !== filter.toLowerCase()) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, query, filter]);

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
          placeholder="Search by name or email"
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

      <div className="flex flex-col">
        {filtered.length === 0 ? (
          <p className="py-4 text-[13px] text-muted">No users match.</p>
        ) : (
          filtered.map((u) => (
            <Link
              key={u.userId}
              href={`/admin/users/${u.userId}`}
              className="flex items-center justify-between gap-[10px] border-b border-rule py-3"
            >
              <div className="flex min-w-0 flex-col gap-[3px]">
                <span className="text-[13.5px]">{u.name}</span>
                <span className="truncate text-[10.5px] text-muted">{metaLine(u)}</span>
              </div>
              <span
                className={
                  "flex-none text-[10.5px] " +
                  (u.displayStatus === "active" ? "text-muted" : "text-penalty")
                }
              >
                {u.displayStatus}
              </span>
            </Link>
          ))
        )}
      </div>

      <div className="text-[11.5px] leading-[1.55] text-muted">
        A user&apos;s activities and evidence are never visible here. Admin sees that they
        exist, not what they contain.
      </div>
    </>
  );
}
