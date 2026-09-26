// Is the app still spending its own design tokens?
//
// WHY THIS EXISTS. A measurement on 2026-09-25, taken after a spacing pass on
// the v5 canvas had to snap 1,300 values with a script:
//
//   colour        18 semantic tokens, 3 arbitrary escapes across 98 files
//   radius        1 token, and Tailwind has no other value to write
//   font size     NO ramp at all, 829 arbitrary values, 23 distinct sizes
//   line height   no tokens, 167 arbitrary values
//   letter spacing no tokens, 152 arbitrary values, 86 of them identical
//   spacing       a 4px scale used 615 times, bypassed 654 times
//
// The config had the right idea twice and stopped. Colour held because a
// semantic token is easier to write than a hex, and radius held because
// `rounded-lg` does not exist. Nothing stopped `text-[11.5px]`, so it was
// written 129 times.
//
// A SCRIPT THAT SNAPS VALUES ONCE IS NOT A FIX: the next `p-[13px]` undoes it.
// This is the fix.
//
// TWO TIERS, because they are two different problems.
//
// BANNED: a property with a COMPLETE token set. There is no honest reason to
// escape it, so any escape fails, at any count. Font size, line height, letter
// spacing and colour.
//
// RATCHETED: a property where a one-off is sometimes real. A 560px reading
// column and a 46px control are not token violations, they are layout. The
// count may fall and may never rise, so new work is standard from today and
// the backlog comes down as files are touched.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Spacing and sizing escapes that remain. Lower it, never raise it.
 *
 * Tightening this IS the maintenance. A ratchet only works if somebody turns
 * it, and the script says so out loud when the count drops.
 */
const CEILING = 528;

const SPACING = "p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y";
const SIZING = "w|h|size|min-w|min-h|max-w|max-h|top|bottom|left|right|inset|basis";

interface Rule {
  what: string;
  pattern: RegExp;
  instead: string;
}

/** No escape is allowed. The token set for these is complete. */
const BANNED: Rule[] = [
  {
    what: "font size",
    pattern: /\btext-\[[0-9.]+(?:px|rem|em)\]/g,
    instead: "text-micro|2xs|xs|sm|base|lg|xl|2xl|3xl|4xl",
  },
  {
    what: "line height",
    pattern: /\bleading-\[[^\]]+\]/g,
    instead: "leading-tight|snug|normal|relaxed|loose",
  },
  {
    what: "letter spacing",
    pattern: /\btracking-\[[^\]]+\]/g,
    instead: "tracking-tight|normal|wide|wider|caps|label|widest",
  },
  {
    what: "colour",
    // A hex anywhere in a class, and the named Tailwind palette, which this
    // app does not use: its colours are semantic tokens over CSS variables.
    pattern:
      /\[#[0-9a-fA-F]{3,8}\]|\b(?:text|bg|border|from|via|to|fill|stroke|ring|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
    instead: "a semantic token: text-muted, border-rule, bg-surface, text-penalty",
  },
  {
    what: "font family",
    pattern: /\bfont-\[[^\]]+\]/g,
    instead: "font-mono, which is the only family this app has",
  },
];

/** Allowed, counted, and the count may only fall. */
const RATCHETED: Rule[] = [
  {
    what: "spacing",
    pattern: new RegExp(`\\b(?:${SPACING})-\\[[0-9.]+(?:px|rem)\\]`, "g"),
    instead: "a Tailwind key: gap-2.5 is 10px, p-3 is 12px, py-5 is 20px",
  },
  {
    what: "sizing",
    pattern: new RegExp(`\\b(?:${SIZING})-\\[[^\\]]+\\]`, "g"),
    instead: "a Tailwind key where one fits",
  },
  {
    what: "inline style",
    // A hardcoded px, rem or hex inside style={{ ... }}. Gradients and a
    // handful of computed values are real; a colour or a padding is not.
    pattern: /style=\{\{[^}]*?(?:[0-9.]+(?:px|rem)|#[0-9a-fA-F]{3,8})[^}]*?\}\}/g,
    instead: "a class, so the token applies and both themes follow it",
  },
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const banned = new Map<string, { file: string; text: string }[]>();
const counts = new Map<string, number>();
const worst = new Map<string, number>();
let ratcheted = 0;

for (const file of walk("src")) {
  const text = readFileSync(file, "utf8");
  if (!text.includes("className") && !text.includes("style=")) continue;
  const where = file.replace(/\\/g, "/");

  for (const { what, pattern } of BANNED) {
    for (const m of text.matchAll(pattern)) {
      banned.set(what, [...(banned.get(what) ?? []), { file: where, text: m[0] }]);
    }
  }

  let here = 0;
  for (const { what, pattern } of RATCHETED) {
    const n = [...text.matchAll(pattern)].length;
    if (n === 0) continue;
    counts.set(what, (counts.get(what) ?? 0) + n);
    here += n;
  }
  if (here > 0) worst.set(where, here);
  ratcheted += here;
}

let failed = 0;

console.log("  BANNED, because the tokens are complete");
for (const { what, instead } of BANNED) {
  const hits = banned.get(what) ?? [];
  if (hits.length === 0) {
    console.log(`    ok    ${what}`);
    continue;
  }
  failed += 1;
  console.log(`    FAIL  ${what}: ${hits.length}`);
  console.log(`          use ${instead}`);
  for (const h of hits.slice(0, 5)) {
    console.log(`            ${h.file}  ${h.text.slice(0, 48)}`);
  }
  if (hits.length > 5) console.log(`            and ${hits.length - 5} more`);
}

console.log("\n  RATCHETED, because a one-off is sometimes real");
for (const { what } of RATCHETED) {
  console.log(`    ${String(counts.get(what) ?? 0).padStart(4)}  ${what}`);
}
console.log(`    ${String(ratcheted).padStart(4)}  total, ceiling ${CEILING}`);

if (ratcheted > CEILING) {
  failed += 1;
  console.log(`\n    FAIL  ${ratcheted - CEILING} more than the ceiling.`);
  console.log("          worst files:");
  for (const [file, n] of [...worst].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.log(`            ${String(n).padStart(3)}  ${file}`);
  }
} else if (ratcheted < CEILING) {
  failed += 1;
  console.log(`\n    FAIL  ${CEILING - ratcheted} below the ceiling, which is good news.`);
  console.log(`          Lower CEILING to ${ratcheted} so it cannot creep back.`);
  console.log("          A ratchet only works if somebody turns it.");
}

if (failed > 0) process.exit(1);
console.log("\nok: the app is still spending its own tokens.");
