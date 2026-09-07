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
}
