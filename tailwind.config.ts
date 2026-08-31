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
      colors: {
        paper: "#E8E6E1",
        ink: "#1A1917",
        dim: "#5A5751",
        rule: "#C4C0B8",
        penalty: "#A3251C",
        pass: "#2F5D3F",
        void: "#000000",
        focus: "#7FA8FF",
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
