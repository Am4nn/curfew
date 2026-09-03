"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ tabs }: { tabs: [string, string][] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="mb-7 flex gap-[18px] overflow-x-auto border-b border-rule">
      {tabs.map(([href, label]) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              "whitespace-nowrap pb-[10px] text-[9.5px] uppercase tracking-[0.08em] " +
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
