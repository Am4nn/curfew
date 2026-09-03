# Next session — queued by Aman, 2026-09-04

## The big one, after the UI is finished

Full verification of the engine, then simulation.

- Verify scoring, reputation, streak and money calculation end to end, not
  screen by screen. `bun run verify` proves stored rows match a recompute; it
  does not prove the recompute is right.
- Then simulate: several days of varied engagement across groups and
  activities, and check what happens to streaks, personal reputation, group
  reputation, fines and balances in each scenario. Joining, leaving, sharing
  and un-sharing, grace running out, an activity switched off mid-month.

## Numbered items from the second review

- **#34, #37** — no such page. Both are manifest routes, same class of fault as
  the four fixed in round 3.
- **#49** — spacing between the admin nav and the first control is wrong on
  every admin page. Match the mock. **#51** has the same fault with a little
  more space than the others.
- **#51** — remove the footer note beginning "Everything here is counted…".
- **#54** — move the Evidence block above the Drift block on Ops.
- **#1** — the group invite on Home needs a better design.
- **#4** — home-empty is meant to be an empty page, and the empty page needs
  something designed on it rather than nothing.
- Group settings page is too cluttered.

## Known bugs still open, not raised by Aman

- `ownerMoneyToggle()` resolves with `resolveAt(rows, new Date())`, so the
  owner half of the money toggle is read as it stands NOW rather than as it
  stood on the period being scored. Same family as the #54 fix. Pre-existing,
  but the round-3 money fix now depends on it, so it matters more than it did.
- `numericValue()` in `src/app/stats/charts.tsx` guesses the module's field by
  trying `steps ?? minutes ?? amount ?? calories ?? glasses`. That is the
  engine knowing what a type means, which invariant 6 forbids. A `numeric`
  chart kind should declare one canonical field name.
- The seeded group ledger dates every entry to the day it was seeded, because
  the fixture writes the whole history's fines in one scoring pass. Fixture
  debt, not app behaviour.

## Questions to put to Aman

1. `/ranks` is global ("Yours, across everything"); the artboard is group-scoped
   ("In Weekend Club. 210 to UNBROKEN."). Which is right? The page is reached
   from Settings AND from a group's Standing tab.
2. The stats detail pages put the chart, then the weekday bars, then the tiles.
   The four artboards disagree with each other on that order. One order for all
   four, or match each mock exactly?
3. Numeric charts are labelled "LAST 29 PERIODS" because the engine may not
   know a type's unit. The mock says "STEPS A DAY, 21 DAYS". Should a module
   declare its own chart heading?
