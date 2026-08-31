"use client";

import { useState } from "react";

type Theme = "dark" | "light";

// Inline segmented control for the Settings screen. No icons: house style bans
// generic line icons, and colour must not be the only carrier of meaning, so
// the state is spelled out. Writes a cookie and flips data-theme on <html> with
// no reload; the server reads the cookie on the next load.
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  function set(next: Theme) {
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  }

  return (
    <div className="flex border border-fg">
      {(["dark", "light"] as Theme[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => set(t)}
          aria-pressed={theme === t}
          aria-label={`${t} theme`}
          className={
            "min-w-[64px] px-3 py-[7px] text-[13px] uppercase tracking-[0.12em] " +
            (theme === t ? "bg-fg text-bg" : "bg-transparent text-muted")
          }
        >
          {t}
        </button>
      ))}
    </div>
  );
}
