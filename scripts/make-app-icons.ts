// Home-screen icons and iOS launch images, drawn from the same mark as
// `src/app/icon.svg`.
//
//   bun run make:icons
//
// Curfew is used as an installed app on a phone, so these are not decoration.
// Android takes its launcher icon and its splash from the manifest. iOS takes
// the icon from `apple-icon`, but its launch image only from
// `apple-touch-startup-image`, and only when a link's media query matches the
// device EXACTLY. A miss is a white screen on every cold start, which on a
// near-black app is the most visible thing it could possibly do.
//
// Committed rather than generated at runtime: they never change, and a static
// file out of `public/` costs nothing to serve.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BG = "#0b0a09"; // --bg, dark
const MARK = "#f2f2f2"; // --fg, dark

/**
 * The quorum mark: four cells on a 32 grid with the bottom-right seat empty.
 * `inset` is the share of the canvas left as margin, which is what separates a
 * plain icon from a maskable one.
 */
function markSvg(size: number, inset: number, background: string | null): string {
  const art = size * (1 - inset * 2);
  const unit = art / 32;
  const at = (n: number) => Math.round(size * inset + n * unit);
  const box = Math.round(13 * unit);
  const cell = (x: number, y: number) =>
    `<rect x="${at(x)}" y="${at(y)}" width="${box}" height="${box}" fill="${MARK}"/>`;
  const ground = background
    ? `<rect width="${size}" height="${size}" fill="${background}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" shape-rendering="crispEdges">
  ${ground}
  ${cell(2, 2)}${cell(17, 2)}${cell(2, 17)}
</svg>`;
}

/** A launch image: the mark centred on the app's own ground. */
function splashSvg(width: number, height: number): string {
  const art = Math.round(Math.min(width, height) * 0.22);
  const unit = art / 32;
  const x0 = Math.round((width - art) / 2);
  const y0 = Math.round((height - art) / 2);
  const box = Math.round(13 * unit);
  const cell = (x: number, y: number) =>
    `<rect x="${Math.round(x0 + x * unit)}" y="${Math.round(y0 + y * unit)}" width="${box}" height="${box}" fill="${MARK}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" shape-rendering="crispEdges">
  <rect width="${width}" height="${height}" fill="${BG}"/>
  ${cell(2, 2)}${cell(17, 2)}${cell(2, 17)}
</svg>`;
}

const png = (svg: string) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

/**
 * Every iPhone still receiving iOS updates, portrait.
 *
 * `width` and `height` are CSS pixels and `scale` the device pixel ratio; the
 * file is their product. The media query has to name all three or iOS ignores
 * the image, which is why this is a table rather than a few sizes that look
 * about right.
 */
const IPHONES = [
  { width: 440, height: 956, scale: 3 }, // 16 Pro Max
  { width: 402, height: 874, scale: 3 }, // 16 Pro
  { width: 430, height: 932, scale: 3 }, // 15 Pro Max, 14 Pro Max
  { width: 393, height: 852, scale: 3 }, // 15, 15 Pro, 14 Pro
  { width: 428, height: 926, scale: 3 }, // 14 Plus, 13 Pro Max, 12 Pro Max
  { width: 390, height: 844, scale: 3 }, // 14, 13, 13 Pro, 12, 12 Pro
  { width: 375, height: 812, scale: 3 }, // 13 mini, 12 mini, 11 Pro, XS, X
  { width: 414, height: 896, scale: 3 }, // 11 Pro Max, XS Max
  { width: 414, height: 896, scale: 2 }, // 11, XR
  { width: 375, height: 667, scale: 2 }, // SE
];

const root = process.cwd();
const icons = path.join(root, "public", "icons");
const splash = path.join(root, "public", "splash");
await mkdir(icons, { recursive: true });
await mkdir(splash, { recursive: true });

// Android reads both. A maskable icon is cropped to whatever shape the
// launcher likes, so the mark sits inside the safe circle rather than bleeding
// to the edge and losing its corners.
// 0.17 leaves the mark at 58% of the tile, the same as `apple-icon.tsx`, and
// for the same reason: at the old 0.0625 it filled 77% and read as a
// full-bleed checkerboard next to apps that keep their glyph well inside.
for (const size of [192, 512]) {
  await writeFile(path.join(icons, `icon-${size}.png`), await png(markSvg(size, 0.17, BG)));
  await writeFile(path.join(icons, `maskable-${size}.png`), await png(markSvg(size, 0.22, BG)));
}
console.log("icons: 192, 512, maskable 192, maskable 512");

const links: string[] = [];
for (const { width, height, scale } of IPHONES) {
  const name = `splash-${width}x${height}@${scale}x.png`;
  await writeFile(path.join(splash, name), await png(splashSvg(width * scale, height * scale)));
  links.push(
    `{ media: "(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${scale})", url: "/splash/${name}" },`,
  );
}
console.log(`splash: ${IPHONES.length} iPhone sizes`);
console.log("\nThe table for layout.tsx, if the sizes above ever change:\n");
console.log(links.join("\n"));
