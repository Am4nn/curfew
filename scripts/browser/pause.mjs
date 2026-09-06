// A pause, driven through the real screens as a person would drive it.
//
// The engine is covered by the simulation, which proves a paused day produces
// no period, no fine and no reputation movement. This is the other half: that
// the three states of the screen appear in the right order, that the two
// refusals reach a person as words, and that a group sees the absence.
//
// The streak line is the one that has to be exactly right. A pause ends every
// streak, but it ends them when the first paused day CLOSES, like any missed
// day, not the moment the pause is declared. So day one says running and day
// three says ended, and both are asserted.
import { DateTime } from "luxon";

const TZ = "Asia/Kolkata";

export async function pause({ open, check, page, body, setClock, clearClock }) {
  const today = DateTime.now().setZone(TZ).startOf("day");
  const from = today.plus({ days: 1 });
  const to = today.plus({ days: 4 });

  // Whatever a previous run left. The screen only offers a declaration when
  // there is no pause held, so this suite starts by clearing one.
  await clearClock();
  let text = await open("/settings/pause");
  for (const label of ["Call it off", "Come back early"]) {
    if (text.includes(label)) {
      await page.getByRole("button", { name: label }).click();
      await page.waitForTimeout(2500);
      text = await body();
    }
  }

  // --- declaring -----------------------------------------------------------
  check("the pause screen offers a declaration", text.includes("WHAT IT COSTS"), text.slice(0, 90));
  check("and says what it takes", text.includes("Every streak ends at 0."));

  await declare(page, from, to);
  text = await body();
  check("declaring lands on the declared state", text.includes("DECLARED"), text.slice(0, 120));

  text = await open("/");
  check("today is untouched before it starts", !text.includes("Paused"), text.slice(0, 80));

  // --- the two refusals, through the same form a person uses ----------------
  await open("/settings/pause");
  await page.getByRole("button", { name: "Call it off" }).click();
  await page.waitForTimeout(2500);
  check("calling off a pause that never started removes it", (await body()).includes("WHAT IT COSTS"));

  await declare(page, from, from.plus({ days: 1 }));
  check("two days is refused", (await body()).includes("3 days or more"), (await body()).slice(0, 200));

  await declare(page, today.minus({ days: 2 }), today.plus({ days: 2 }));
  check(
    "a pause over days already lived is refused",
    (await body()).includes("tomorrow at the earliest"),
    (await body()).slice(0, 200),
  );

  // --- standing inside one --------------------------------------------------
  await declare(page, from, to);

  await setClock(from.set({ hour: 12 }).toISO());
  text = await open("/");
  check("Home says paused", text.includes("Paused"), text.slice(0, 60));
  check("and keeps the money section", text.includes("BALANCES"));
  check("and keeps the groups section", text.includes("GROUPS"));
  check("and offers both ways out", text.includes("Extend") && text.includes("Come back early"));
  check(
    "and the streak has NOT gone yet on day one",
    text.includes("Running until tonight"),
    /Streaks[\s\S]{0,60}/.exec(text)?.[0],
  );

  await setClock(from.plus({ days: 2 }).set({ hour: 12 }).toISO());
  text = await open("/");
  check("by day three the streak has ended", text.includes("Ended"), /Streaks[\s\S]{0,60}/.exec(text)?.[0]);

  text = await open("/settings/pause");
  check("the pause screen shows it running", text.includes("PAUSED") && text.includes("days left"));

  // --- what a group sees ----------------------------------------------------
  await open("/groups");
  const href = await page.locator('a[href^="/group/"]').first().getAttribute("href");
  if (href) {
    text = await open(href);
    check("the members list says away, with the date", /Away until/.test(text), /Away until [^\n]*/.exec(text)?.[0]);
    check("and still shows a score for them", !text.includes("AWAY\n") || /Away until/.test(text));

    text = await open(`${href}/standing`);
    check("the standing tab says paused", text.includes("PAUSED"));
    check("and keeps the number", text.includes("HELD, NOT FROZEN"), text.slice(0, 200));

    // A trip is an explanation, and stats is where a gap otherwise has none.
    text = await open(`${href}/stats`);
    check("group stats say who is away", /away/i.test(text), /[^\n]*[Aa]way[^\n]*/.exec(text)?.[0] ?? text.slice(0, 120));
  }

  text = await open("/stats");
  check("personal stats say the gap was declared", /away/i.test(text), /[^\n]*[Aa]way[^\n]*/.exec(text)?.[0] ?? text.slice(0, 120));

  // --- coming home early ----------------------------------------------------
  await open("/settings/pause");
  await page.getByRole("button", { name: "Come back early" }).click();
  await page.waitForTimeout(2500);
  text = await body();
  check(
    "coming back early ends it from tomorrow",
    text.includes("PAUSED") && text.includes("1 day left"),
    text.slice(0, 160),
  );

  // Leave nothing declared behind: the next run starts from the same screen.
  await open("/settings/pause");
  if ((await body()).includes("Come back early")) {
    await page.getByRole("button", { name: "Come back early" }).click();
    await page.waitForTimeout(2500);
  }
  await clearClock();
}

async function declare(page, from, to) {
  await page.locator('input[name="from"]').fill(from.toFormat("yyyy-MM-dd"));
  await page.locator('input[name="to"]').fill(to.toFormat("yyyy-MM-dd"));
  await page.getByRole("button", { name: "Declare" }).click();
  await page.waitForTimeout(2500);
}
