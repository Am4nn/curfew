"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ tabs }: { tabs: [string, string][] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="-mx-5 mb-7 flex gap-[12px] overflow-x-auto border-b border-rule px-5">
      {tabs.map(([href, label]) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              "whitespace-nowrap pb-[10px] text-[9.5px] uppercase tracking-[0.08em] " +
              (active ? "text-fg shadow-[inset_0_-2px_0_var(--fg)]" : "text-muted")
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
