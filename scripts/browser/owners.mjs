// Who runs a group, and taking back an invite, through the real controls.
//
// `break-in` proves the guards refuse the wrong people. It cannot prove a
// button is wired to the right one, and that is the failure this catches: an
// action pointed at the wrong helper passes every direct round, because the
// direct round calls the helper itself.
//
// The seed makes Preview Admin the sole owner of Night Owls, with Alex and Sam
// as members, and leaves one invite out to newcomer@curfew.local. Every check
// below is written against that.
const GROUP = "00000000-0000-0000-0000-0000000000a1";
const MEMBER = "Alex Rivera";

/**
 * The row of a list belonging to one person or one address.
 *
 * Both filters matter. Keyed on the text alone, the innermost matching div is
 * the label's own wrapper, which does not contain the button, so every click
 * timed out looking inside it. Keyed on the text AND a button, the innermost
 * match is the row itself.
 */
function rowFor(page, name) {
  return page
    .locator("div")
    .filter({ has: page.getByText(name, { exact: true }) })
    .filter({ has: page.getByRole("button") })
    .last();
}

/** That row's own text, once it says what it is expected to say. */
async function untilRow(page, name, predicate, timeout = 25000) {
  const deadline = Date.now() + timeout;
  let text = "";
  while (Date.now() < deadline) {
    text = (await rowFor(page, name).innerText().catch(() => "")).replace(/\s+/g, " ").trim();
    if (predicate(text)) return text;
    await page.waitForTimeout(250);
  }
  return text;
}

export async function owners({ open, check, page, until }) {
  let text = await open(`/group/${GROUP}/settings`);
  check(
    "the settings tab says who runs the group",
    text.includes("WHO RUNS THIS GROUP"),
    text.slice(0, 120),
  );
  check("and lists the members", text.includes(MEMBER), text.slice(0, 160));

  // The rule that keeps a group administrable, asked of the screen rather than
  // of the function. Preview Admin is the only owner, so this must refuse, and
  // the refusal has to reach the person as words.
  await rowFor(page, "Preview Admin (you)").getByRole("button", { name: "Step down" }).click();
  text = await until((t) => t.includes("A group needs an owner"));
  check(
    "the only owner cannot step down, and is told why",
    text.includes("A group needs an owner"),
    text.slice(0, 200),
  );

  // Promote, and the row says so.
  await rowFor(page, MEMBER).getByRole("button", { name: "Make owner" }).click();
  let row = await untilRow(page, MEMBER, (t) => t.includes("Owner"));
  check(`${MEMBER} becomes an owner`, row.includes("Owner"), row);

  // And back down, which is the half that makes a misclick recoverable.
  await rowFor(page, MEMBER).getByRole("button", { name: "Step down" }).click();
  row = await untilRow(page, MEMBER, (t) => t.includes("Member"));
  check(`${MEMBER} can be taken back down`, row.includes("Member"), row);

  // The invite this group has out, and taking it back.
  text = await open(`/group/${GROUP}/settings`);
  check("the invites it has out are listed", text.includes("INVITES OUT"), text.slice(0, 120));
  check("with the address on it", text.includes("newcomer@curfew.local"));

  await rowFor(page, "newcomer@curfew.local").getByRole("button", { name: "Cancel" }).click();
  text = await until((t) => !t.includes("newcomer@curfew.local"));
  check(
    "cancelling takes the invite off the list",
    !text.includes("newcomer@curfew.local"),
    text.slice(0, 160),
  );
}
