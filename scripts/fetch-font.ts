// Put IBM Plex Mono in the repo, so the app actually renders in its own
// typeface.
//
//   bun run fetch:font
//
// `tailwind.config.ts` has said "IBM Plex Mono throughout. No system-sans
// anywhere." since the beginning, and CLAUDE.md lists system-sans as a visual
// tell to avoid. Nothing ever loaded the font. The stack falls back to
// `ui-monospace`, so every phone has been drawing the app in SF Mono or
// Roboto Mono, and the artboards the screens were reviewed against were
// drawn in Plex. The design was right and the delivery was missing.
//
// Latin only. The app's copy is English and the money formatter emits digits
// and currency symbols; the Cyrillic, Greek and Vietnamese subsets would
// triple the weight for glyphs nothing renders. `latin-ext` is kept because a
// member's name can carry an accent.
//
// Committed rather than fetched at build time: a build that reaches out to a
// third party is a build that can fail for a reason nobody controls.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

// The weights the app uses: normal, font-medium, font-semibold.
const WEIGHTS = [400, 500, 600];
const WANT = new Set(["latin", "latin-ext"]);

const out = path.join(process.cwd(), "public", "fonts");
const server = path.join(process.cwd(), "assets", "fonts");
await mkdir(out, { recursive: true });
await mkdir(server, { recursive: true });

const css = await fetch(
  `https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@${WEIGHTS.join(";")}&display=swap`,
  { headers: { "User-Agent": UA } },
).then((r) => r.text());

// Google labels each block with the subset it covers in a comment above it.
const blocks = css.split("/* ").slice(1);
const faces: { weight: number; subset: string; file: string; range: string }[] = [];

for (const block of blocks) {
  const subset = block.slice(0, block.indexOf(" */"));
  if (!WANT.has(subset)) continue;
  const weight = Number(/font-weight:\s*(\d+)/.exec(block)?.[1] ?? 0);
  const url = /(https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)/.exec(block)?.[1];
  const range = /unicode-range:\s*([^;]+)/.exec(block)?.[1]?.trim() ?? "";
  if (!weight || !url) continue;

  const file = `ibm-plex-mono-${weight}-${subset}.woff2`;
  const response = await fetch(url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(path.join(out, file), bytes);
  faces.push({ weight, subset, file, range });
  console.log(`${file}  ${(bytes.length / 1024).toFixed(1)} KB`);
}

// Satori cannot read woff2, and the OG card has to be drawn in the same face
// as the app. These go to `assets/`, NOT `public/`: they are read on the server
// when the card is generated, and 256 KB nobody ever requests has no business
// on a public path. `next.config.ts` traces them into the deployment.
const ttf = await fetch(
  `https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap`,
).then((r) => r.text());
for (const weight of [400, 600]) {
  const url = new RegExp(
    `font-weight:\\s*${weight}[\\s\\S]*?(https://fonts\\.gstatic\\.com/[^)]+\\.ttf)`,
  ).exec(ttf)?.[1];
  if (!url) continue;
  const response = await fetch(url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(path.join(server, `ibm-plex-mono-${weight}.ttf`), bytes);
  console.log(`assets/fonts/ibm-plex-mono-${weight}.ttf  ${(bytes.length / 1024).toFixed(1)} KB  (server only)`);
}

console.log("\nThe @font-face rules for globals.css:\n");
for (const f of faces) {
  console.log(`@font-face {
  font-family: "IBM Plex Mono";
  font-style: normal;
  font-weight: ${f.weight};
  font-display: swap;
  src: url("/fonts/${f.file}") format("woff2");
  unicode-range: ${f.range};
}`);
}
