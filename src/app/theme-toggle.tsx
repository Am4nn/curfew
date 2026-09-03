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
    <div className="flex border border-rule">
      {([
        ["dark", "Dark"],
        ["light", "Light"],
      ] as [Theme, string][]).map(([t, label], i) => (
        <button
          key={t}
          type="button"
          onClick={() => set(t)}
          aria-pressed={theme === t}
          aria-label={`${label} theme`}
          className={
            "flex-1 px-1 py-[10px] text-center text-[12.5px] " +
            (i === 1 ? "border-l border-rule " : "") +
            (theme === t ? "bg-fg text-bg" : "bg-transparent text-muted")
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}
