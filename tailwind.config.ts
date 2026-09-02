import type { Config } from "tailwindcss";

// Tokens are the design reference in .planning/curfew-ui.html. That file is
// hand-written CSS and is not copied; only its token values live here.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // Zero border radius is the house style. No pill buttons, no rounded cards.
    borderRadius: {
      none: "0",
      DEFAULT: "0",
    },
    extend: {
      // Semantic tokens backed by CSS variables so the same class works in both
      // themes. Values live in globals.css: dark is the default (:root), light
      // overrides under [data-theme="light"]. A nested [data-theme="dark"]
      // re-forces dark for its subtree, which is how the night check-in screen
      // stays black regardless of the global choice.
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        fg: "var(--fg)",
        muted: "var(--muted)",
        rule: "var(--rule)",
        // The dashed edge of an empty photo slot: a step lighter than a rule,
        // and the only place it is used.
        dash: "var(--dash)",
        penalty: "var(--penalty)",
        pass: "var(--pass)",
        accent: "var(--accent)",
      },
      fontFamily: {
        // IBM Plex Mono throughout. No system-sans anywhere.
        mono: [
          "'IBM Plex Mono'",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
