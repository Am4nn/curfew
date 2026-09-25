import type { Config } from "tailwindcss";

// Tokens are the design reference in .planning/curfew-ui.html. That file is
// hand-written CSS and is not copied; only its token values live here.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // Zero border radius is the house style. No pill buttons, no rounded cards.
    //
    // Note the shape of this: it OVERRIDES rather than extends, so Tailwind's
    // own radius scale does not exist and `rounded-lg` is not a class anybody
    // can write. Enforcement by absence. `fontSize` below does the same thing
    // for the same reason.
    borderRadius: {
      none: "0",
      DEFAULT: "0",
    },

    // ------------------------------------------------------------------
    // THE TYPE RAMP (1.61).
    //
    // Measured before it was written: 98 component files used **23 distinct
    // font sizes across 829 arbitrary values** and not one named size. There
    // was no ramp to drift from, which is why it drifted.
    //
    // Ten sizes, and every old value rounds DOWN to the nearest. Down rather
    // than nearest, because a smaller size can only make text narrower, and
    // narrower text cannot wrap where it did not wrap before. The Home status
    // line has 34 characters of room measured to the pixel (1.45).
    //
    // OVERRIDES, so `text-[13px]` is the only way out and `check:tokens`
    // counts every one of them.
    // ------------------------------------------------------------------
    fontSize: {
      micro: ["10px", "1.45"],
      "2xs": ["11px", "1.45"],
      xs: ["12px", "1.45"],
      sm: ["13px", "1.45"],
      base: ["14px", "1.5"],
      lg: ["16px", "1.4"],
      xl: ["20px", "1.3"],
      "2xl": ["26px", "1.2"],
      "3xl": ["30px", "1.2"],
      "4xl": ["38px", "1.1"],
    },

    extend: {
      // Semantic tokens backed by CSS variables so the same class works in both
      // themes. Values live in globals.css: dark is the default (:root), light
      // overrides under [data-theme="light"]. A nested [data-theme="dark"]
      // re-forces dark for its subtree, which is how the night check-in screen
      // stays black regardless of the global choice.
      //
      // This is the part of the config that WORKED: 18 semantic tokens, and
      // across 98 files only three arbitrary colours ever escaped it. The type
      // ramp above exists because nobody did the same for text.
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        fg: "var(--fg)",
        muted: "var(--muted)",
        rule: "var(--rule)",
        // The dashed edge of an empty photo slot: a step lighter than a rule,
        // and the only place it is used.
        dash: "var(--dash)",
        gold: "var(--gold)",
        // The streak colour. The only place it is used as a colour rather than
        // inside the flame's own gradient is the Restore control (item 19).
        flame: {
          DEFAULT: "var(--flame)",
          from: "var(--flame-from)",
          to: "var(--flame-to)",
        },
        rank: {
          doubt: "var(--rank-doubt)",
          intent: "var(--rank-intent)",
          practice: "var(--rank-practice)",
          discipline: "var(--rank-discipline)",
          unbroken: "var(--rank-unbroken)",
        },
        penalty: "var(--penalty)",
        pass: "var(--pass)",
        accent: "var(--accent)",
      },

      // THE LABEL SPACING (1.61). 152 uses across ten values and no tokens,
      // and 86 of them were the same number: 0.16em, the small-caps section
      // label that appears on nearly every screen. A value written eighty-six
      // times is a token nobody named.
      letterSpacing: {
        tight: "-0.015em",
        normal: "0",
        wide: "0.06em",
        wider: "0.1em",
        caps: "0.14em",
        label: "0.16em",
        widest: "0.2em",
      },

      // Five, snapped from the nine that were in use. `relaxed` carries 90 of
      // the 167 uses on its own, which is what a default looks like when
      // nobody named it.
      lineHeight: {
        tight: "1.2",
        snug: "1.35",
        normal: "1.45",
        relaxed: "1.55",
        loose: "1.7",
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

// SPACING IS DELIBERATELY NOT OVERRIDDEN, and that is a finding rather than an
// omission. Tailwind's default scale IS a 4px system, and 615 uses across the
// app already sit on it. The drift is the 654 arbitrary values beside them, and
// 262 of those name a size that already has a key: `gap-[10px]` is `gap-2.5`.
//
// So spacing did not need a new system. It needed the one it had to be
// enforced, which is `check:tokens`.
