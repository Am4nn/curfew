// Whether the two answers on an abstinence row actually look like two answers.
//
// The row replaced a whole screen: an abstinence type has no fields and no
// photograph, so its check-in was a heading, the question the row had already
// asked, two buttons and two paragraphs, reached by a press, to record one
// boolean. It is answered in place now.
//
// The first version shipped broken in a way nothing here could have caught,
// because nothing stored was wrong. `CheckinButton` renders a div with a button
// inside it, so that the error message has somewhere to live, which means the
// DIV is what a flex row lays out. The sizing classes were passed as
// `className` and reached the button; the div went on hugging its contents.
// Two buttons meant to split the row came out small and shoved against the left
// edge. Every test passed. It was visible only by looking at it.
//
// So this measures. The two answers must be the same width as each other and
// must between them span the row, which is a fact no amount of correct state
// implies. What they RECORD is tested in src/domain/catalog.test.ts: see the
// note further down for why a browser cannot honestly ask that question.
import { DateTime } from "luxon";

const TZ = "Asia/Kolkata";
// The seeded account tracks Nightfast and deliberately leaves Sugar-free
// untracked, so this is the abstinence type actually on the board.
const KEY = "nightfast";

/** The two answers on the row, as elements. */
function answers(page) {
  return {
    held: page.getByRole("button", { name: "It held", exact: true }),
    slipped: page.getByRole("button", { name: "I slipped", exact: true }),
  };
}

/** This morning at a given hour, as the preview clock wants it. */
const at = (hour) => DateTime.now().setZone(TZ).set({ hour, minute: 0, second: 0 }).toISO();

export async function declare({ open, check, page, setClock, clearClock }) {
  // Nightfast confirms between 6 and 11 in the morning, so without a clock this
  // check would pass or fail on what time CI happened to run.
  //
  // Nine in the morning: inside it, so the row draws its two answers at all.
  await setClock(at(9));
  await open("/");

  const { held, slipped } = answers(page);
  const there = (await held.count()) > 0 && (await slipped.count()) > 0;
  check("both answers are on the Home row", there);
  if (!there) return;

  // Nothing links to the old screen any more.
  const links = await page.locator(`a[href="/checkin/${KEY}"]`).count();
  check("and nothing on Home points at a check-in screen for it", links === 0, `${links} links`);

  // The measurement. Equal to each other, and together most of the row.
  //
  // The row, not `main`. On a desktop viewport `main` is the whole window and
  // the list sits in a column a third of it wide, so measuring against `main`
  // called a pair of buttons that filled their row perfectly a 43% failure.
  const a = await held.boundingBox();
  const b = await slipped.boundingBox();
  const width = await held.evaluate((el) => {
    const owner = el.closest("div.border-b");
    return owner ? owner.getBoundingClientRect().width : 0;
  });
  if (!a || !b || !width) {
    check("the answers have a size", false);
    return;
  }

  check(
    "the two answers are the same width",
    Math.abs(a.width - b.width) <= 2,
    `${Math.round(a.width)} and ${Math.round(b.width)}`,
  );
  // Generous on purpose: this is here to catch a button that shrank to its own
  // text, not to pin a layout to the pixel. The gap between them is the only
  // thing the pair does not cover.
  const span = (a.width + b.width) / width;
  check(
    "and between them they span the row",
    span > 0.9,
    `${Math.round(span * 100)}% of the row`,
  );
  check(
    "and neither is a hit target smaller than a thumb",
    a.height >= 40 && b.height >= 40,
    `${Math.round(a.height)} and ${Math.round(b.height)}`,
  );

  // What this suite does NOT do is press a button and check what was recorded.
  // A press through a browser is stamped by the database: recordEvent leaves
  // occurred_at to the column default, deliberately, so that a clock nobody
  // controls is the one that writes history (invariant 8). The preview clock
  // scrubs every READ and cannot move that stamp, so a press made inside a
  // scrubbed window lands at the real time, outside it, and the row correctly
  // ignores it. Scrubbing cannot help: no time of day is inside a 6-to-11
  // window except between 6 and 11.
  //
  // Chasing that through the browser tests the harness, not the app. The
  // sentence the row shows is `hint`, and it is tested where the timestamps
  // belong to us, in src/domain/catalog.test.ts under "abstinence types".

  await clearClock();
}
