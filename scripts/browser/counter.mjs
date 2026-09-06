// The `+1` on Home, and the one thing about it a screenshot cannot show.
//
// A counter's row goes optimistic on the press: it shows `nextStatus`, the
// module's own line as it would read once one more press lands, so the number
// moves before the round trip returns. `nextStatus` is only ever true of the
// render that was on screen when the button went down, and the row used to keep
// substituting it for four seconds afterwards, which is long after the server's
// own render has arrived carrying the press already counted. The line read one
// too high for the rest of that window and then fell back:
//
//   0 of 8  ->  1 of 8  ->  2 of 8  ->  1 of 8
//
// Nothing stored was ever wrong, which is why nothing caught it. The unit tests
// see the module's two sentences and both are correct. `verify` sees the events
// and they are correct. Only a browser holding the row through the refresh sees
// the wrong one on screen. That is what this does.
import { DateTime } from "luxon";

const TZ = "Asia/Kolkata";
const TYPE = "Water";

/** The Home row for one activity, as its lines. */
async function row(body, name) {
  const lines = (await body()).split("\n");
  const i = lines.findIndex((l) => l.trim() === name);
  return i < 0 ? [] : lines.slice(i, i + 4).map((l) => l.trim());
}

const has = (lines, text) => lines.some((l) => l.includes(text));

/** The row's count line, whatever it currently says. */
async function count(body) {
  return (await row(body, TYPE)).find((l) => l.includes("of 8")) ?? "(no count)";
}

/**
 * Wait for the count to leave `from`, and say what it moved to.
 *
 * Polled rather than slept. A fixed wait was long enough running this suite
 * alone and not long enough with four others ahead of it on the same dev
 * server, which made the check fail for a reason that was never the app.
 */
async function movedFrom(page, body, from) {
  for (let i = 0; i < 80; i += 1) {
    const line = await count(body);
    if (line !== "(no count)" && !line.includes(from)) return line;
    await page.waitForTimeout(250);
  }
  return "(never moved)";
}

export async function counter({ open, check, page, body, setClock, clearClock }) {
  // A day nobody has drunk anything on yet. The seed finishes today's eight
  // glasses, and a completed counter offers no button to press.
  const tomorrow = DateTime.now().setZone(TZ).plus({ days: 1 }).startOf("day").plus({ hours: 10 });
  await setClock(tomorrow.toISO());
  await open("/");

  let lines = await row(body, TYPE);
  check(`${TYPE} starts the day at none`, has(lines, "0 of 8"), lines.join(" | "));
  check("and offers the press", has(lines, "+1"), lines.join(" | "));

  const plus = () => page.getByRole("button", { name: "+1", exact: true }).first();
  await plus().click();

  check("the press moves the count", (await movedFrom(page, body, "0 of 8")).includes("1 of 8"));

  // Through the refresh and out the far side of the mark. The row is held for
  // four seconds after a press, and the whole of that window has to read the
  // same number. Sampled rather than checked once, because the wrong value
  // arrived late and left on its own.
  const seen = new Set();
  for (let i = 0; i < 14; i += 1) {
    seen.add(await count(body));
    await page.waitForTimeout(400);
  }
  check(
    "and it says one, the whole way through the refresh",
    seen.size === 1 && [...seen][0].includes("1 of 8"),
    [...seen].join(" then "),
  );

  // A second press, to prove the fix did not simply turn the optimism off.
  await plus().click();
  check("a second press moves it again", (await movedFrom(page, body, "1 of 8")).includes("2 of 8"));

  // Arriving from the check-in screen, which is the other way a row is marked.
  // The server has already counted the press by the time this render is made,
  // so there is nothing to be optimistic about and the count must not move.
  await open("/?done=water");
  const after = new Set();
  for (let i = 0; i < 12; i += 1) {
    after.add(await count(body));
    await page.waitForTimeout(400);
  }
  check(
    "arriving from a check-in does not add one",
    after.size === 1 && [...after][0].includes("2 of 8"),
    [...after].join(" then "),
  );

  await clearClock();
}
