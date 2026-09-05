import { check, section, skipped } from "./harness";
import type { World } from "./world";

// The other half: real requests to a running server.
//
// `direct.ts` proves the guards exist. It cannot prove a route reaches them. A
// page that forgot `assertMember` passes every direct round, because the direct
// rounds call the helper that has it. Only a request can say whether the route
// does.
//
// Two shapes, because the server can be in two states:
//
//   LOCAL_MODE  every request is PREVIEW_USER, whoever the cookies say. The
//               identity is fixed, so pointing it at a group it is not in is
//               precisely an access-control test, and that is the sweep worth
//               running here.
//   real auth   no cookie means nobody, so the sweep is: does any route serve
//               anything at all to a stranger off the street.
//
// Neither shape can reach a SERVER ACTION. Actions are addressed by an id Next
// mints at build time and embeds in the payload, so forging one is a test of
// Next rather than of Curfew. Every action's guard is called directly in
// `direct.ts` instead, and the two together are the coverage.

interface Probe {
  status: number;
  location: string | null;
  body: string;
}

async function get(url: string, headers: Record<string, string> = {}): Promise<Probe> {
  const response = await fetch(url, { redirect: "manual", headers });
  return {
    status: response.status,
    location: response.headers.get("location"),
    body: await response.text().catch(() => ""),
  };
}

/** Reachable, and which of the two shapes it is in. */
async function shapeOf(base: string): Promise<"local" | "auth" | "pending" | null> {
  try {
    const home = await get(base);
    if (home.status === 200) return "local";
    const to = home.location ?? "";
    if (to.includes("/pending") || to.includes("/consent")) return "pending";
    if (to.includes("/signin")) return "auth";
    // A redirect somewhere else is still a redirect: nothing was served.
    return "auth";
  } catch {
    return null;
  }
}

/**
 * The routes worth sweeping, and what makes each one private.
 *
 * `secrets` are strings that must not appear in a response served to somebody
 * with no right to it: the group's name, and the name of the member inside it.
 * Status codes are not the test. A 200 that renders an empty shell or an error
 * boundary is fine; a 200 carrying either of those is not, and a members list
 * that leaked without the heading would still be caught by the second one.
 */
function routes(w: World): { path: string; secrets: string[] }[] {
  const theirs = [`${w.tag} theirs`, `Break ${w.stranger.slice(-8)}`];
  const nothing: string[] = [];
  return [
    { path: `/group/${w.theirs}`, secrets: theirs },
    { path: `/group/${w.theirs}/standing`, secrets: theirs },
    { path: `/group/${w.theirs}/evidence`, secrets: theirs },
    { path: `/group/${w.theirs}/settings`, secrets: theirs },
    { path: `/group/${w.theirs}/stats`, secrets: theirs },
    { path: `/group/${w.theirs}/ledger`, secrets: theirs },
    { path: `/join/${w.invite}`, secrets: theirs },
    { path: "/", secrets: nothing },
    { path: "/activities", secrets: nothing },
    { path: "/groups", secrets: nothing },
    { path: "/balances", secrets: nothing },
    { path: "/stats", secrets: nothing },
    { path: "/settings", secrets: nothing },
    { path: "/settings/sharing", secrets: nothing },
    { path: "/settings/data", secrets: nothing },
    { path: "/settings/photos", secrets: nothing },
    { path: "/ranks", secrets: nothing },
    { path: "/checkin/water", secrets: nothing },
    { path: "/admin", secrets: nothing },
    { path: "/admin/users", secrets: nothing },
    { path: "/admin/groups", secrets: nothing },
    { path: "/admin/controls", secrets: nothing },
    { path: "/admin/ops", secrets: nothing },
    { path: "/admin/reports", secrets: nothing },
    { path: "/admin/insights", secrets: nothing },
  ];
}

export async function run(
  w: World,
  base: string,
  opts: { defaulted: boolean; localHere: boolean },
): Promise<void> {
  const shape = await shapeOf(base);
  if (shape === null) {
    section("HTTP");
    skipped("the whole HTTP sweep", `nothing answered at ${base}. Start the server first.`);
    return;
  }
  // Nobody named this origin, so it was guessed. A guess is only safe when the
  // server turns out to be the one this script's own database belongs to, and
  // LOCAL_MODE on both sides is the only thing that says so. Sweeping a server
  // reading somewhere else finds nothing on every route and calls it a pass.
  if (opts.defaulted && opts.localHere && shape !== "local") {
    section("HTTP");
    skipped(
      "the whole HTTP sweep",
      `${base} is not in LOCAL_MODE, so it is reading a different database than this run. Pass --http=<origin> to sweep it anyway.`,
    );
    return;
  }
  if (shape === "pending") {
    section("HTTP");
    skipped(
      "the whole HTTP sweep",
      `${base} redirects everything to a gate, so a sweep would pass without testing anything. Seed it first.`,
    );
    return;
  }

  if (shape === "local") await sweepAsFixedIdentity(w, base);
  else await sweepAsNobody(w, base);

  await apiRoutes(w, base, shape);
}

/**
 * LOCAL_MODE: every request is the preview account, and the run added it to
 * nothing. So each of these asks for something that belongs to somebody else.
 */
async function sweepAsFixedIdentity(w: World, base: string): Promise<void> {
  section("HTTP: another person's things, as the fixed local identity");

  // The positive control, first. Every check below says "this string was not in
  // the response", and a string that is never in ANY response makes all of them
  // pass for the wrong reason. So prove the detector works on a group this
  // identity is genuinely in before trusting it on one they are not.
  if (w.control) {
    const control = await get(`${base}/group/${w.control}`);
    check(
      "the detector works: a group you ARE in shows its name",
      control.status === 200 && control.body.includes(`${w.tag} control`),
      `${control.status}`,
    );
  } else {
    skipped(
      "the positive control",
      "no fixed identity in this database, so the sweep below proves less",
    );
  }

  let leaked = 0;
  for (const route of routes(w)) {
    if (route.secrets.length === 0) continue;
    const r = await get(base + route.path);
    const found = route.secrets.filter((s) => r.body.includes(s));
    const disclosed = r.status === 200 && found.length > 0;
    if (disclosed) leaked += 1;
    check(`${route.path} discloses nothing`, !disclosed, `${r.status}${found.length ? " leaked " + found.join(", ") : ""}`);
  }
  check("nothing leaked across the whole sweep", leaked === 0, `${leaked} route(s)`);
}

/** Real auth: a stranger off the street, with no cookie at all. */
async function sweepAsNobody(w: World, base: string): Promise<void> {
  section("HTTP: every route, signed out");
  let served = 0;
  for (const route of routes(w)) {
    const r = await get(base + route.path);
    // Signed out, a page either sends you to sign in or refuses. What it must
    // never do is render.
    const rendered = r.status === 200 && !r.body.includes("/signin");
    if (rendered) served += 1;
    check(`${route.path} is not served signed out`, !rendered, `${r.status} ${r.location ?? ""}`);
  }
  check("nothing was served to nobody", served === 0, `${served} route(s)`);
}

async function apiRoutes(w: World, base: string, shape: "local" | "auth"): Promise<void> {
  section("HTTP: the API routes");

  // The cron endpoint is a public URL that scores everybody. Its only guard is
  // the bearer token.
  const noSecret = await get(`${base}/api/cron/score`);
  check("the cron endpoint refuses no token", noSecret.status === 401, `${noSecret.status}`);
  const wrongSecret = await get(`${base}/api/cron/score`, {
    authorization: "Bearer not-the-secret",
  });
  check("and refuses the wrong one", wrongSecret.status === 401, `${wrongSecret.status}`);

  // A check-in is a POST. A GET must not record one (invariant 9).
  const getCheckin = await get(`${base}/api/checkin`);
  check(
    "a GET cannot reach the check-in route",
    getCheckin.status === 405 || getCheckin.status === 404,
    `${getCheckin.status}`,
  );

  if (shape === "auth") {
    for (const path of ["/api/checkin", "/api/evidence/upload-url"]) {
      const r = await fetch(base + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      check(`${path} refuses a request with no session`, r.status === 401, `${r.status}`);
    }
  } else {
    skipped(
      "the signed-out API checks",
      "LOCAL_MODE answers every request as the preview account by design",
    );
  }

  // The local evidence store is a file server keyed by a URL parameter, which
  // is the shape of thing that must never serve anything it was not signed for.
  const key = `ev/${w.admin}/${w.TYPE}/${w.today}/${w.tag}kkkkkkkk.jpg`;
  const unsigned = await get(`${base}/api/evidence/local/${key}`);
  check(
    "an unsigned evidence URL is refused",
    unsigned.status !== 200,
    `${unsigned.status}`,
  );
  const forged = await get(
    `${base}/api/evidence/local/${key}?expires=${Math.floor(Date.now() / 1000) + 600}&signature=${"0".repeat(64)}`,
  );
  check("a forged signature is refused", forged.status !== 200, `${forged.status}`);
  const expired = await get(
    `${base}/api/evidence/local/${key}?expires=1&signature=${"0".repeat(64)}`,
  );
  check("an expired URL is refused", expired.status !== 200, `${expired.status}`);
  for (const traversal of ["..%2f..%2f..%2fpackage.json", "ev/..%2f..%2fpackage.json"]) {
    const r = await get(`${base}/api/evidence/local/${traversal}?expires=9999999999&signature=x`);
    check(`the evidence route refuses "${traversal}"`, r.status !== 200, `${r.status}`);
  }

  // A route that does not exist must say so rather than falling through to
  // something that does.
  const nowhere = await get(`${base}/api/nope`);
  check("an unknown API route answers nothing", nowhere.status !== 200, `${nowhere.status}`);
}
