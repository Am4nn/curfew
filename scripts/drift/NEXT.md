# Next session

Last updated 2026-09-04, after the phase 5 to 8 pass and the Home review.

## Still open

### The big one, and the only thing left from the original queue

Full verification of the engine, then simulation. Explicitly queued for after
the UI, and the UI is now finished.

- Verify scoring, reputation, streak and money calculation end to end, not
  screen by screen. `bun run verify` proves stored rows match a recompute; it
  does not prove the recompute is right.
- Then simulate: several days of varied engagement across groups and
  activities, and check what happens to streaks, personal reputation, group
  reputation, fines and balances in each scenario. Joining, leaving, sharing
  and un-sharing, grace running out, an activity switched off mid-month.

### Small, carried

- **The Home `+1` tick is not optimistic.** It disables, says what it is doing
  and refreshes, so it has feedback, but the count does not move until the
  round trip lands. The other reversible controls (sharing toggles, evidence
  checkboxes, invite dismiss) do move on the press. Admin Controls is
  deliberately not on this list: it is draft-then-Save with a consequences
  sheet, so its toggles are local state and already instant.
- **The seeded group ledger dates every entry to the day it was seeded**,
  because the fixture writes the whole history's fines in one scoring pass.
  Fixture debt, not app behaviour, and it makes the ledger screen a poor test
  of date grouping.

### Found while working, not yet ruled on

- **Nine live routes have no artboard and so no drift entry**: `/balances`,
  `/ledger`, `/settings/personal`, `/settings/stored`, `/settings/rules`,
  `/checkin`, `/admin/reports`, `/admin/groups/[id]`, `/admin/users/[id]`.
  Four have v1/v2 boards in `.design/`, but those are the old design language,
  so pairing one against a v3 screen would report permanent drift. `/signin`
  and `/pending` also need a signed-out fixture the harness does not have.
  Roughly nine new artboards plus a fixture.
- **The drift harness cannot tell a rendered error page from a rendered
  screen.** It photographed `error.tsx` and reported a pass during the Home
  work; only looking at the image caught it. Same class of blindness as the
  fixture bug behind #34 and #37. It should fail when the error boundary is on
  screen.
- **`/settings/photos` has no pagination.** 68 tiles in one scroll on the
  fixture, and the group evidence tab has "Load older" while this does not.
- **`V3Data.dc.html` still says "with your name removed where it can be".**
  The app no longer does that, as of the ledger name freeze. Left alone rather
  than edited; needs either a corrected board or a decision to edit it.

## Done, for the record

Everything below shipped between 2026-09-03 and 2026-09-04.

### The numbered list

- **#34, #37** — never wrong routes. `run-all.mjs` reseeds per fixture and
  `shots.ts` was being run directly, so those screens were photographed against
  the wrong world, which looks exactly like a real 404. The harness now records
  the seeded fixture and refuses to capture a screen that needs another.
- **#49** admin nav spacing, **#51** footer note, **#54** Evidence above Drift.
- **#1** the Home invite, three times over. It is a plain box with three
  controls now: Accept opens the join screen, Decline revokes, and the cross
  hides it while the invite stays pending (migration 0016).
- **#4** the empty Home, redesigned around the catalog, with an invite variant.
  New boards `V3HomeStart` and `V3HomeStartInvite`, and a `new-user-invite`
  fixture for a state that could not be photographed before.
- **Group settings** reduced to the mock's shape, with a confirmation on leave.

### The second testing batch

Camera switch, retake, upload, image quality, the note boxes, your own evidence
in both places, the untracked-sharing bug, one shared button kit with pending
and pressed states everywhere, and the ledger name freeze.

The upload failure was an environment fault, not a product one: `.env.local`
carries no R2 credentials, so `presign()` threw and the client reported
"Network failed". `src/server/r2.ts` has a `LOCAL_MODE` branch now, which is
why the three camera bugs behind it were findable at all.

### The three answered questions and the two known bugs

`/ranks` stays global. One section order on all four stats screens. Each module
names its own chart heading, which also removed `numericValue()`'s field
guessing. `ownerMoneyToggle()` resolves per day rather than as it stands now.

### The panels

The tinted block with a coloured bar down its side is gone from fifteen app
screens and nineteen artboards. Footnotes are plain muted text; a penalty keeps
its colour, because that one is a warning rather than small print.
