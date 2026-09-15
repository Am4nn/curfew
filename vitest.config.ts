import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // `scripts` too, for the one thing in there worth a unit test:
    // `release-notes.json` is otherwise read for the first time by a script run
    // by hand after the tag, so a malformed file fails at the worst possible
    // moment and a well-formed one that renders wrong cannot be taken back.
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
