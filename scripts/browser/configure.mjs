// The configure screen, in both of its shapes.
//
// It used to be every control at once, and not one line saying what they added
// up to: a day picker, the module's own fields, a gap and grace, on a screen
// that never stated the rule. You configured it by guessing.
//
// Now the rule is stated first and the controls are behind it, in two shapes
// for two jobs. Setting one up asks one question a screen. Changing one lists
// what is set, so you find the one thing you came for and leave.
//
// Both are drawn from the same panels array, which is the thing worth testing:
// a type with three fields and a type with none have to come out right without
// the screen knowing what any field means.

/** A tracked type, an untracked one, and the type with no fields of its own. */
const TRACKED = "water";
const UNTRACKED = "sugarfree";
const NO_FIELDS = "gym";

const has = (text, s) => text.includes(s);

export async function configure({ open, check, page, body }) {
  // ----------------------------------------------------------------------
  // Changing one: the rule, then a list.
  // ----------------------------------------------------------------------
  await open(`/activities/${TRACKED}`);
  let text = await body();

  check("a tracked activity states its rule", has(text, "THE RULE"), text.slice(0, 120));
  check(
    "and the rule is a sentence, not a set of controls",
    /Every day: \d+ glasses of water\./.test(text),
    (text.match(/Every day:[^\n]*/) ?? ["none"])[0],
  );
  check("and it offers to change one thing", has(text, "CHANGE ONE THING"));

  // The list has to say what everything is SET to, or it is a list of words.
  for (const [label, value] of [
    ["How often", "every day"],
    ["Glasses a day", "8 glasses"],
    ["Misses forgiven", "2 a month"],
  ]) {
    check(`the list says ${label} is ${value}`, has(text, label) && has(text, value), text.slice(0, 400));
  }

  // None of the engine's own words survive on the screen.
  for (const word of ["Day boundary", "Grace", "Threshold", "Logs required", "perWeek"]) {
    check(`and never says "${word}"`, !has(text, word));
  }

  // One row, one control. The point of the list is that you do not meet the
  // other eleven controls on your way to the one you wanted.
  await page.getByRole("button", { name: /Glasses a day/ }).click();
  await page.waitForTimeout(400);
  text = await body();
  check("opening a row shows that control", has(text, "GLASSES A DAY"), text.slice(0, 200));
  check("and not the others", !has(text, "Misses forgiven") && !has(text, "CHANGE ONE THING"));
  check("and offers a way back that changes nothing", has(text, "Cancel"));

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForTimeout(400);
  text = await body();
  check("cancelling returns to the list", has(text, "CHANGE ONE THING"));

  // ----------------------------------------------------------------------
  // Setting one up: one question a screen.
  // ----------------------------------------------------------------------
  await open(`/activities/${UNTRACKED}`);
  text = await body();

  check(
    "an untracked activity asks one question instead",
    has(text, "How often") && !has(text, "CHANGE ONE THING"),
    text.slice(0, 200),
  );
  check(
    "and asks it as a question",
    /How often do you want to do this\?/.test(text),
    (text.match(/How often[^\n]*/) ?? ["none"])[0],
  );
  check("and does not show later questions yet", !has(text, "Misses forgiven"));

  // Walk it to the end. Every Next must land somewhere, and the last screen
  // has to state the rule before anything is committed.
  let steps = 0;
  for (; steps < 8; steps += 1) {
    const next = page.getByRole("button", { name: "Next", exact: true });
    if ((await next.count()) === 0) break;
    await next.click();
    await page.waitForTimeout(300);
  }
  text = await body();
  check("walking it through reaches the end", steps > 0 && steps < 8, `${steps} questions`);
  check("and the last screen states the rule", has(text, "THE RULE"), text.slice(0, 200));
  check(
    "and only then offers to start",
    has(text, "Start tracking") || has(text, "Add and share"),
    text.slice(0, 300),
  );
  check("and a way back to change an answer", has(text, "Back"));

  // ----------------------------------------------------------------------
  // The type with nothing of its own.
  // ----------------------------------------------------------------------
  await open(`/activities/${NO_FIELDS}`);
  text = await body();
  check(
    "gym's rule reads as a rule despite it declaring no fields",
    /Any \d+ days a week: a session at the gym\./.test(text),
    (text.match(/Any[^\n]*gym\./) ?? ["none"])[0],
  );
  check(
    "and it never asks for a weekly number twice",
    (text.match(/days a week/g) ?? []).length <= 2,
    `${(text.match(/days a week/g) ?? []).length} mentions`,
  );
}
