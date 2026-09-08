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

  // The by-activity rows on Stats go to that activity's own chart, and for a
  // long time nothing on them said so: no chevron, no press state, on a row
  // shaped exactly like Home's, which is not a link. A screen nobody knows they
  // can press is a screen nobody opens, and no snapshot can catch that.
  const statsText = await open("/stats");
  const toChart = page.locator('a[href^="/stats?a="]').first();
  const anyRow = (await toChart.count()) > 0;
  check("a stats row leads to its own chart", anyRow);
  if (anyRow) {
    check(
      "and the section says the rows can be pressed",
      statsText.includes("TAP FOR THE CHART"),
    );
    const chart = await open(await toChart.getAttribute("href"));
    check(
      "and the chart it leads to renders",
      !chart.includes("Something failed") && chart.includes("STATS"),
      chart.slice(0, 90),
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
