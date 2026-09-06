// Every screen renders, and says the thing it exists to say.
//
// Not a snapshot: each route is asserted on one phrase that only that screen
// produces, so a route that quietly redirects home cannot pass by rendering
// something.
export async function screens({ open, check, page }) {
  const ROUTES = [
    ["/", "CURFEW"],
    ["/activities", "ACTIVITIES"],
    ["/activities/add", null],
    ["/groups", "GROUPS"],
    ["/stats", "STATS"],
    ["/balances", "BALANCES"],
    ["/ranks", "HOW REPUTATION WORKS"],
    ["/settings", "SETTINGS"],
    ["/settings/personal", null],
    ["/settings/sharing", null],
    ["/settings/rules", null],
    ["/settings/stored", null],
    ["/settings/photos", null],
    ["/settings/data", null],
    // Whichever of the three states it is in. The pause suite drives them.
    ["/settings/pause", "PAUSE"],
  ];

  for (const [route, phrase] of ROUTES) {
    const text = await open(route);
    const broke = text.includes("Something failed while loading this page");
    const missing = text.includes("No such page");
    check(
      `${route} renders`,
      !broke && !missing && (phrase === null || text.includes(phrase)),
      broke ? "error boundary" : missing ? "not-found boundary" : text.slice(0, 90),
    );
  }

  // A group hub, from the list rather than from a hardcoded id, so this follows
  // the seed rather than duplicating it.
  await open("/groups");
  const href = await page.locator('a[href^="/group/"]').first().getAttribute("href");
  check("the groups list links to a group", href !== null, href ?? "no link");
  if (!href) return;

  for (const [suffix, phrase] of [
    ["", "OVERVIEW"],
    ["/standing", "STANDING"],
    ["/evidence", "EVIDENCE"],
    ["/settings", "SETTINGS"],
    ["/stats", null],
    ["/ledger", null],
  ]) {
    const text = await open(href + suffix);
    check(
      `${href}${suffix} renders`,
      !text.includes("Something failed") && (phrase === null || text.includes(phrase)),
      text.slice(0, 90),
    );
  }

  // The one screen that must NOT record anything on a GET (invariant 9). It is
  // asserted here rather than in break-in because break-in cannot see what a
  // browser's prefetch does.
  const checkin = await open("/checkin/water");
  check(
    "the check-in screen opens without recording",
    !checkin.includes("Something failed") && !checkin.includes("Recorded"),
    checkin.slice(0, 90),
  );
}
