"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The one navigation, present on every member-facing screen. Admin is not a tab
// (it is a header link for admins); the check-in has no screen of its own any
// more, it lives on Home. Hidden on the pre-approval and admin surfaces, which
// carry their own chrome.
const HIDDEN = ["/signin", "/pending"];

type Tab = { href: string; label: string; icon: React.ReactNode; match: (p: string) => boolean };

const TABS: Tab[] = [
  {
    href: "/",
    label: "Home",
    match: (p) => p === "/" || p === "/balances",
    icon: (
      <path d="M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5" />
    ),
  },
  {
    href: "/groups",
    label: "Groups",
    match: (p) => p === "/groups" || p.startsWith("/group/"),
    icon: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M16.5 6.2a3 3 0 0 1 0 5.6" />
        <path d="M15.5 20a5.5 5.5 0 0 0-1.2-3.5" />
      </>
    ),
  },
  {
    href: "/stats",
    label: "Stats",
    match: (p) => p.startsWith("/stats"),
    icon: (
      <path d="M4 20V11M10 20V4M16 20v-6" />
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    match: (p) => p === "/settings",
    icon: (
      <>
        <line x1="4" y1="8" x2="20" y2="8" />
        <line x1="4" y1="16" x2="20" y2="16" />
        <circle cx="9" cy="8" r="2.3" fill="var(--bg)" />
        <circle cx="15" cy="16" r="2.3" fill="var(--bg)" />
      </>
    ),
  },
];

export function TabBar() {
  const pathname = usePathname() ?? "/";
  if (HIDDEN.includes(pathname) || pathname.startsWith("/admin")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-bg">
      <div className="mx-auto flex max-w-[560px]">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={
                "flex flex-1 flex-col items-center gap-[5px] px-0 pb-3 pt-[10px] text-[11px] " +
                (active ? "text-fg" : "text-muted")
              }
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                aria-hidden="true"
              >
                {t.icon}
              </svg>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
