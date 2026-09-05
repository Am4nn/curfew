"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

// Inline segmented control for the Settings screen. No icons: house style bans
// generic line icons, and colour must not be the only carrier of meaning, so
// the state is spelled out. Writes a cookie and flips data-theme on <html> with
// no reload; the server reads the cookie on the next load.
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  // Push the choice out to the two things that are not React: the attribute the
  // stylesheet reads, and the cookie the server reads on the next load. Both are
  // external systems being brought in line with state, which is exactly what an
  // effect is for. Writing them from the click handler instead mutated values
  // the component does not own.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
  }, [theme]);

  return (
    <div className="flex border border-rule">
      {([
        ["dark", "Dark"],
        ["light", "Light"],
      ] as [Theme, string][]).map(([t, label], i) => (
        <button
          key={t}
          type="button"
          onClick={() => setTheme(t)}
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
