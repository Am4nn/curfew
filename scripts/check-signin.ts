// Can a signed-out visitor actually see the sign-in page?
//
//   bun run check:signin -- --http=https://dev.curfew.amanarya.com
//
// Reported as "Image doesn't load from mobile safari neither from windows
// chrome", with three broken tiles on the landing page.
//
// The middleware matcher was a list of folders, and a list has to be extended
// by whoever adds the next one. `/landing/gym.webp` was not on it, so a
// signed-out visitor was handed the page and every photograph on it answered
// 307 with a chunk of HTML, which a browser draws as a broken image. The
// folder was added; then the font, the icons, the launch images, the manifest
// and `robots.txt` arrived and were gated in exactly the same way.
//
// So this asks for EVERYTHING the page references, plus the files a browser
// and a crawler request by name, rather than for the three it was written
// about. Checking the specific thing that broke last time is how the same bug
// ships twice.
//
// Nothing else could have caught it. Every browser check runs in LOCAL_MODE,
// where `previewEnabled()` makes the middleware stand aside entirely, so the
// one code path that breaks this is the one path the suite never takes. This
// asks the question the way a stranger does: no cookie, no preview.
//
// Exits non-zero if anything the sign-in page needs is not reachable signed
// out. Takes an origin; defaults to BETTER_AUTH_URL.

// A module, so top-level await is allowed. There is nothing to import.
export {};

const arg = process.argv.find((a) => a.startsWith("--http="));
const ORIGIN = (arg?.slice("--http=".length) ?? process.env.BETTER_AUTH_URL ?? "")
  .replace(/\/$/, "");

if (!ORIGIN) {
  console.error("No origin. Pass --http=<origin> or set BETTER_AUTH_URL.");
  process.exit(1);
}

let failed = 0;

function check(what: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${what}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed += 1;
}

/** No cookie jar, no redirect following: exactly what a stranger's first GET is. */
async function get(path: string): Promise<Response> {
  return fetch(`${ORIGIN}${path}`, { redirect: "manual" });
}

console.log(`\n--- ${ORIGIN}, signed out ---`);

const page = await get("/signin");
check("the sign-in page answers", page.status === 200, `status ${page.status}`);

const html = page.status === 200 ? await page.text() : "";

// EVERYTHING the page asks for, not a list of what it asked for once.
//
// The first version of this looked for "/landing/..." specifically, which is
// the mistake it was written to catch wearing different clothes. When the
// font, the icons, the launch images and the manifest arrived they were gated
// exactly as the photographs had been, and this check said all clear, because
// it was still looking at the three files from last time.
//
// So: pull every absolute reference out of the page and try all of them.
const refs = new Set<string>();

// Attributes only. A dev server inlines module specifiers all over the page,
// so anything that greps the whole document for something ending in `.js`
// comes back with `./node_modules/next/dist/...` and fails on sixteen files
// that were never requests.
for (const m of html.matchAll(/(?:href|src)="(\/[^"?#]+)"/g)) {
  const url = m[1];
  // The framework's own bundles are not what this is about, and in dev they
  // are not stable paths either.
  if (url.startsWith("/_next/")) continue;
  refs.add(url);
}

// next/image puts the real source percent-encoded inside the optimizer's url,
// so the markup names the optimizer and not the file it will go and fetch.
// Read it out of that parameter rather than scanning the page.
for (const m of html.matchAll(/\/_next\/image\?url=([^"&]+)/g)) {
  try {
    const decoded = decodeURIComponent(m[1]);
    if (decoded.startsWith("/")) refs.add(decoded);
  } catch {
    // A url that will not decode is not one the browser will fetch either.
  }
}

// And the files no page links to, which a browser and a crawler ask for by
// name. A redirect here is not a broken image, it is no app install and a
// `robots.txt` that says nothing.
for (const wellKnown of [
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image",
  "/apple-icon",
]) {
  refs.add(wellKnown);
}

const wanted = [...refs].sort();
check("the page asks for something", wanted.length > 0, `${wanted.length} references`);

for (const src of wanted) {
  const res = await get(src);
  const type = res.headers.get("content-type") ?? "";
  const ok = res.status === 200;
  check(
    `${src} is served`,
    ok,
    ok ? type.split(";")[0] : `status ${res.status} to ${res.headers.get("location") ?? "?"}`,
  );
  // A 200 carrying the sign-in page is the same failure wearing a better
  // status code.
  if (ok && /\.(webp|png|jpe?g|avif|svg|woff2?)$/.test(src)) {
    check(`   and is not HTML`, !type.includes("text/html"), type || "no content-type");
  }
}

// The optimized form of each image, which next/image is what actually puts in
// the markup. It fetches the source itself, so it can fail while the raw file
// is fine.
for (const src of wanted.filter((u) => /\.(webp|png|jpe?g|avif)$/.test(u))) {
  const opt = await get(`/_next/image?url=${encodeURIComponent(src)}&w=384&q=75`);
  check(
    `${src} survives the image optimizer`,
    opt.status === 200,
    opt.status === 200
      ? (opt.headers.get("content-type") ?? "")
      : `status ${opt.status} to ${opt.headers.get("location") ?? "?"}`,
  );
}

// The gate still has to be a gate. If this fails, the exclusions above went
// too far and something private is now reachable.
//
// Skipped against a local server, where LOCAL_MODE is exactly what makes the
// middleware stand aside: asserting it there would fail every run and teach
// everybody to ignore the check that exists to be believed.
const local = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(ORIGIN);
if (local) {
  console.log("skip  the gate is open in LOCAL_MODE by design, so it is not asked here");
} else {
  const home = await get("/");
  check(
    "and the app itself is still behind sign-in",
    home.status === 307 || home.status === 302,
    `status ${home.status} to ${home.headers.get("location") ?? "?"}`,
  );
}

console.log(`\n${failed === 0 ? "all reachable" : `${failed} failed`}\n`);
process.exit(failed === 0 ? 0 : 1);
