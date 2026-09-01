"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function GroupTabs({ groupId }: { groupId: string }) {
  const pathname = usePathname() ?? "";
  const base = `/group/${groupId}`;
  const tabs: [string, string][] = [
    [base, "Overview"],
    [`${base}/ledger`, "Ledger"],
    [`${base}/rules`, "Rules"],
    [`${base}/wake`, "Wake"],
  ];

  return (
    <nav className="mt-[14px] flex gap-5 border-b border-rule">
      {tabs.map(([href, label]) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              "pb-2 text-[13px] " +
              (active ? "border-b-2 border-fg text-fg" : "text-muted")
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
