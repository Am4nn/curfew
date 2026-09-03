"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Four tabs in every group. Group stats hang off Overview rather than taking a
// fifth, because a tab you visit once a week does not earn permanent chrome.
const TABS = [
  { slug: "", label: "OVERVIEW" },
  { slug: "evidence", label: "EVIDENCE" },
  { slug: "standing", label: "STANDING" },
  { slug: "settings", label: "SETTINGS" },
];

export function GroupTabs({ groupId }: { groupId: string }) {
  const pathname = usePathname();
  const base = `/group/${groupId}`;

  return (
    <div className="flex border-b border-rule px-5">
      {TABS.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = tab.slug
          ? pathname.startsWith(href)
          : pathname === base || pathname === `${base}/`;
        return (
          <Link
            key={tab.slug}
            href={href}
            className={
              "mr-[22px] pb-[10px] text-[11px] tracking-[0.12em] " +
              (active ? "text-fg shadow-[inset_0_-2px_0_var(--fg)]" : "text-muted")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
