// The admin console, over HTTP, as an admin.
//
// Its capability gate is covered directly and its routes are covered signed
// out. What was never covered is an admin actually pressing something: a server
// action reached through the form that is wired to it, with the console's own
// confirm step in the way. A guard can be correct and the wiring wrong, and
// nothing below the browser can tell the difference.
//
// Everything here is put back. The retention control moves by one day and
// returns, and Rebuild is idempotent by construction: it recomputes from events
// and writes the same rows.
export async function admin({ open, check, page, body, until }) {
  for (const [route, phrase] of [
    ["/admin", "ADMIN"],
    ["/admin/users", null],
    ["/admin/groups", null],
    ["/admin/controls", "THE APP"],
    ["/admin/ops", "RECOMPUTE"],
    ["/admin/reports", null],
    ["/admin/insights", null],
  ]) {
    const text = await open(route);
    check(
      `${route} renders for an admin`,
      !text.includes("Something failed") && (phrase === null || text.includes(phrase)),
      text.slice(0, 90),
    );
  }

  // -- an app-wide setting, changed and put back ------------------------------
  let text = await open("/admin/controls");
  const before = /(\d+) days/.exec(text)?.[1];
  check("controls shows the retention window", before !== undefined, before ?? text.slice(0, 90));
  if (before === undefined) return;

  await page.getByRole("button", { name: "More days" }).click();
  check(
    "changing a control offers to save rather than saving",
    (await until((t) => t.includes("unsaved"))).includes("unsaved"),
  );

  await page.getByRole("button", { name: "Save", exact: true }).click();
  const sheet = await until((t) => t.includes("Save 1 change?"));
  check("saving asks first, with the consequence", sheet.includes("Save 1 change?"), sheet.slice(0, 120));

  await page.getByRole("button", { name: "Save changes" }).click();
  await until((t) => !t.includes("Save 1 change?"));

  text = await open("/admin/controls");
  const after = /(\d+) days/.exec(text)?.[1];
  check(
    "an admin action over HTTP changed the app",
    after === String(Number(before) + 1),
    `${after} was ${before}`,
  );

  // And back, so the fixture is where it was found.
  await page.getByRole("button", { name: "Fewer days" }).click();
  await until((t) => t.includes("unsaved"));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await until((t) => t.includes("Save 1 change?"));
  await page.getByRole("button", { name: "Save changes" }).click();
  await until((t) => !t.includes("Save 1 change?"));
  text = await open("/admin/controls");
  check(
    "and put it back",
    /(\d+) days/.exec(text)?.[1] === before,
    `${/(\d+) days/.exec(text)?.[1]} wanted ${before}`,
  );

  // -- the two Ops primitives -------------------------------------------------
  await open("/admin/ops");
  await page.getByRole("button", { name: "Rebuild" }).click();
  // A rebuild replays every user, so how long it takes depends on the fixture
  // and on the machine. `SubmitButton` disables itself for the duration, so the
  // button coming back is the job finishing, and waiting for that is neither a
  // guess nor a ceiling somebody has to raise later.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].some(
        (b) => /rebuild/i.test(b.textContent ?? "") && !b.disabled,
      ),
    null,
    { timeout: 120000 },
  );
  text = await body();
  check("Rebuild runs and comes back", !text.includes("Something failed"), text.slice(0, 90));

  text = await open("/admin/ops");
  check(
    "and the rebuilt rows match a fresh recompute",
    text.includes("No drift"),
    (/DRIFT[\s\S]{0,120}/.exec(text)?.[0] ?? text.slice(0, 120)),
  );

  // SCHEDULER, above drift. A seeded database has never run a job, so every
  // row reads "never run", which is the case worth pinning: it must not report
  // a fresh install as an outage. "late" is the word that means something is
  // wrong, and it must not be on this page.
  const scheduler = /SCHEDULER([\s\S]*?)EVIDENCE/.exec(text)?.[1] ?? "";
  check(
    "the scheduler section is there and a seeded database is not an outage",
    scheduler.includes("Scoring") &&
      scheduler.includes("Reminders") &&
      scheduler.includes("Nightly") &&
      scheduler.includes("never run") &&
      !scheduler.includes("late"),
    scheduler.slice(0, 220) || "no SCHEDULER section",
  );

  // -- Verify recomputes without reloading the page ---------------------------
  // It was a `<button form="recompute-range">` on a `<form method="get">`, so
  // pressing it was a native form submit: a full document navigation that tore
  // the whole app down and built it again, scroll position and all. That is a
  // reload however it is described, and it is what an admin saw.
  //
  // Both outcomes render the same screen, so this watches the two things only a
  // real document load does: fire a `load` event, and take `window` with it.
  // A client navigation does neither.
  let loads = 0;
  const countLoad = () => {
    loads += 1;
  };
  page.on("load", countLoad);
  await page.evaluate(() => {
    window.__stayed = true;
  });
  await page.getByRole("button", { name: "Verify" }).click();
  // Busy for the length of the recompute, back to "Verify" when the answer
  // lands. Playwright re-injects this across a navigation, so under the old
  // code it would have waited for the RELOADED page's button and then found no
  // marker, which is the failure this is here to produce.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].some(
        (b) => /^verif/i.test((b.textContent ?? "").trim()) && !b.disabled,
      ),
    null,
    { timeout: 120000 },
  );
  const stayed = await page.evaluate(() => window.__stayed === true);
  page.off("load", countLoad);
  check(
    "Verify recomputes without reloading the page",
    stayed && loads === 0,
    stayed ? `${loads} document load(s)` : "the document was replaced",
  );
  check(
    "and the range it reports is still on screen",
    (await body()).includes("DRIFT, LAST RUN"),
    (await body()).slice(0, 90),
  );

  // The other branch: an edited range, which navigates rather than refreshing.
  // Worth its own check because the two dates and both buttons now share one
  // piece of state, and that is what fixed the second defect here. Rebuild's
  // hidden inputs used to carry the range the SERVER last rendered, so editing
  // the dates and pressing Rebuild rewrote a different range from the one on
  // screen. The drift line naming the edited range is that state being the
  // single one both controls read.
  //
  // Read back off the URL and out of the box rather than off the drift copy.
  // The box is keyed on what the SERVER rendered, so it holding the edited date
  // is the server having been asked for that range, and it says so whether the
  // range came back clean or carrying drift.
  const edited = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  await page.getByLabel("From").fill(edited);
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForFunction(
    (want) => location.search.includes(`from=${want}`),
    edited,
    { timeout: 60000 },
  );
  check(
    "an edited range is the range it verifies",
    (await page.getByLabel("From").inputValue()) === edited,
    `box reads ${await page.getByLabel("From").inputValue()}, wanted ${edited} at ${page.url()}`,
  );
}
