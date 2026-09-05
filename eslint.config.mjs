// Flat config, ESLint 9. `bun run lint` runs this with --max-warnings=0, and CI
// runs the same command, so a warning is a failure and there is no second class
// of lint result that everybody learns to scroll past.
//
// `next lint` is gone in Next 16 and was only ever a wrapper around this. Next's
// own rules are still here, both sets of them, so nothing it checked is lost.
//
// Type-aware rules are on. They are the half that finds real bugs (a floating
// promise, an unawaited write, a value that is not the string it is treated as),
// and this codebase is full of async database calls with no transaction to roll
// a dropped one back.
import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import next from "@next/eslint-plugin-next";
import globals from "globals";

export default defineConfig([
  globalIgnores([
    ".next/**",
    "node_modules/**",
    ".sim/**",
    ".design/**",
    "scripts/drift/out/**",
    "next-env.d.ts",
  ]),

  {
    files: ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node },
    },
    settings: { react: { version: "detect" } },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "@next/next": next,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,

      // An unused name is either a leftover or a mistake. `_` prefixed is the
      // deliberate one, which useActionState's ignored first argument needs.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],

      // A promise dropped on the floor stays on: a write that never lands is
      // exactly the failure this codebase cannot see, because it has no
      // transactions to roll one back.
      //
      // The one place it is turned off is a JSX attribute. React ignores what a
      // handler returns, `onClick={async () => ...}` is the idiom the framework
      // documents, and the alternative is `void` in front of forty handlers,
      // which reads as a warning about nothing.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },

  // Config and build files run outside the app's tsconfig, so nothing type-aware
  // can be resolved for them.
  {
    files: ["**/*.mjs", "**/*.js", "**/*.cjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
]);
