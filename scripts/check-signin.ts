// Can a signed-out visitor actually see the sign-in page?
//
//   bun run check:signin -- --http=https://dev.curfew.amanarya.com
//
// Reported as "Image doesn't load from mobile safari neither from windows
// chrome", with three broken tiles on the landing page.
//
// The middleware matcher excluded `_next/static`, `_next/image` and the auth
// routes, and nothing else. `/landing/gym.webp` is none of those, so the gate
// redirected it to /signin: a signed-out visitor was handed the page and then
// every photograph on it answered 307 with a chunk of HTML, which a browser
// draws as a broken image. `_next/image` was excluded and bounced anyway,
// because the optimizer fetches the source over HTTP and the gate caught that.
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

// Every image the page asks for has to be reachable by the person reading it.
// Pulled out of the HTML rather than listed here, so adding a fourth
// photograph is covered without touching this file.
//
// Both spellings. `next/image` puts the OPTIMIZED url in the markup with the
// source percent-encoded inside it, so a plain search for "/landing/..."
// finds nothing on a page whose images are all next/image.
const decoded = html.replace(/%2F/gi, "/");
const sources = [
  ...decoded.matchAll(/\/landing\/[A-Za-z0-9_-]+\.(?:webp|png|jpg|jpeg|avif)/g),
].map((m) => m[0]);
const wanted = [...new Set(sources)];
check("and it asks for its photographs", wanted.length > 0, `${wanted.length} found`);

for (const src of wanted) {
  const res = await get(src);
  const type = res.headers.get("content-type") ?? "";
  check(
    `${src} is served, not redirected`,
    res.status === 200,
    res.status === 200 ? type : `status ${res.status} to ${res.headers.get("location") ?? "?"}`,
  );
  // A 200 carrying HTML is the same failure wearing a better status code.
  if (res.status === 200) {
    check(`${src} is an image`, type.startsWith("image/"), type || "no content-type");
  }

  // The optimized URL is what next/image actually puts in the markup, and it
  // fetches the source itself, so it can fail while the raw file is fine.
  const optimized = `/_next/image?url=${encodeURIComponent(src)}&w=384&q=75`;
  const opt = await get(optimized);
  check(
    `and its optimized form is too`,
    opt.status === 200,
    opt.status === 200
      ? (opt.headers.get("content-type") ?? "")
      : `status ${opt.status} to ${opt.headers.get("location") ?? "?"}`,
  );
}

// The gate still has to be a gate. If this passes, the fix above went too far.
const home = await get("/");
check(
  "and the app itself is still behind sign-in",
  home.status === 307 || home.status === 302,
  `status ${home.status} to ${home.headers.get("location") ?? "?"}`,
);

console.log(`\n${failed === 0 ? "all reachable" : `${failed} failed`}\n`);
process.exit(failed === 0 ? 0 : 1);
