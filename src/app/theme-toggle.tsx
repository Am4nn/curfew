"use client";

import { useState } from "react";

type Theme = "dark" | "light";

// Segmented text control. No icons: house style bans generic line icons, and
// colour must not be the only carrier of meaning, so the state is spelled out.
// The active theme is passed from the server (read from the cookie) so the
// first paint already matches and nothing flips on hydration.
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  function set(next: Theme) {
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  }

  return (
    <div className="fixed right-3 top-3 z-20 flex border border-rule">
      {(["dark", "light"] as Theme[]).map((t) => (
        <button
          key={t}
          onClick={() => set(t)}
          aria-pressed={theme === t}
          aria-label={`${t} theme`}
          className={
            "px-[9px] py-[5px] text-[11px] uppercase tracking-[0.12em] " +
            (theme === t ? "bg-fg text-bg" : "bg-transparent text-muted")
          }
        >
          {t}
        </button>
      ))}
    </div>
  );
}
