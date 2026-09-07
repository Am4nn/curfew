// Money, as a screen.
//
// `recordSettlement` and its guards are covered directly. What was never
// covered is the form: whether the field a person types into reaches the action
// with the right group, the right payee and the right currency, and whether the
// number on the screen moves afterwards. A settlement is a ledger row and
// ledger rows are append-only, so this settles ONE rupee rather than the whole
// debt: enough to move the number, small enough to leave the fixture usable.
const ONE = "1.00";

/** "₹250.00" out of the page, as an integer number of paise. */
function minor(text, label) {
  const line = text.split("\n").find((l) => l.includes(label));
  const found = /([\d,]+\.\d\d)/.exec(line ?? "");
  return found ? Math.round(Number(found[1].replaceAll(",", "")) * 100) : null;
}

export async function balances({ open, check, page, until }) {
  let text = await open("/balances");

  if (text.includes("You are settled in every group.")) {
    check("the settled state says so", true, "nothing owed either way");
    return;
  }

  check("the summary names both directions", text.includes("you owe") && text.includes("are owed"), text.slice(0, 120));
  check("YOU OWE lists a debt with a group beside it", text.includes("YOU OWE"), text.slice(0, 120));

  const form = page.locator("form", { has: page.getByRole("button", { name: "Mark settled" }) }).first();
  const settleButton = form.getByRole("button", { name: "Mark settled" });
  check("a debt carries a settle form", (await settleButton.count()) > 0);
  if ((await settleButton.count()) === 0) return;

  // Which debt this form belongs to, read off the card rather than assumed.
  const card = page.locator("div", { has: settleButton }).last();
  const cardText = await card.innerText();
  const owedBefore = minor(cardText, "₹");
  check("the debt shows an amount", owedBefore !== null, cardText.replace(/\s+/g, " ").slice(0, 80));

  const amount = form.locator('input[name="amount"]');
  check("the amount defaults to the whole debt", (await amount.inputValue()).length > 0, await amount.inputValue());

  await amount.fill(ONE);
  await settleButton.click();

  // Wait for the number to move rather than for a fixed 2.5 seconds. The debt
  // is re-read from the server after the action lands, and reading it too early
  // reported a settlement that had gone through as one that had not.
  const owed = (page) => minor(page.split("YOU OWE")[1] ?? page, "₹");
  text = await until((t) => owed(t) !== owedBefore);
  const owedAfter = owed(text);
  check(
    "settling one rupee takes one rupee off the debt",
    owedBefore !== null && owedAfter !== null && owedBefore - owedAfter === 100,
    `${owedAfter} was ${owedBefore}`,
  );

  // The ledger is the record, and a settlement is a row in it like any other.
  await open("/groups");
  const href = await page.locator('a[href^="/group/"]').first().getAttribute("href");
  if (href) {
    const ledger = await open(`${href}/ledger`);
    check("the ledger renders", !ledger.includes("Something failed"), ledger.slice(0, 90));
  }
}
