# Next session

Last updated 2026-09-05, after the scoring, streak and money rebuild.

## Still open

### The big one, and the only thing left from the original queue

Full verification of the engine, then simulation. Explicitly queued for after
the UI, and the UI is now finished.

- Verify scoring, reputation, streak and money calculation end to end, not
  screen by screen. `bun run verify` proves stored rows match a recompute; it
  does not prove the recompute is right. It now covers outcomes, the ledger and
  the streak as well, so the gap is narrower than it was, but the point stands:
  agreeing with itself is not the same as being right.
- Then simulate: several days of varied engagement across groups and
  activities, and check what happens to streaks, personal reputation, group
  reputation, fines and balances in each scenario. Joining, leaving, sharing
  and un-sharing, grace running out, an activity switched off mid-month.
- After that, a pass over all twelve activities, since the gym bugs were the
  kind only a real press finds.

### Performance: done

Home was 6.8 seconds, then 1.9, then 1.2. It is 135ms cold and 88ms warm on the
seeded local database, and a full replay of one user is 346ms rather than 2.9
seconds. Three things did it, all in `.planning/v3/SCORING.md`:

- reputation carries the stored balance forward instead of replaying the curve
  from the join date,
- the streak is stored and moved by the press instead of derived on every read,
- the effective-dated histories are read once per group rather than once per
  day, and the read path above them once per request rather than once per
  activity.

`bun run verify` still replays everything from the beginning, which is what
makes those three safe to trust, and the cron now runs it nightly.

### The review gate

`SCREENS.md` is ticked by a person opening each screen beside its artboard, not
by the harness. Everything on the Gaps page is unticked because it has never
been reviewed, and so are the Configure and Check-in rows and the four from the
check-in feedback work.

### Decisions nobody has made

- **`/settings/personal` sets the same three sleep windows that
  `/activities/sleep` sets**, through a different control, and both are live.
  Two ways to change one thing is one too many. The artboard is drawn as it
  stands and marked, rather than quietly redesigned. Deliberately parked.

### Known, and deliberate

- **Per-commit `*.vercel.app` preview URLs cannot upload a photo.** Each
  environment's R2 bucket allowlists only its own domain, so a preview
  deployment that is not aliased to `dev.curfew.amanarya.com` fails the CORS
  preflight. Fixable by allowing the `*.vercel.app` pattern, at the cost of
  letting any deployment in the account write to the bucket. Left as is.

## Needs a person, not code

- `JURISDICTION.city` in `src/server/policy.ts` is a placeholder.
- The terms have not been read by a lawyer.
- **The production cutover.** Production still serves v2.5 from the old US
  Neon project while `vercel.json` pins `sin1`. That pairing is only safe
  because no tag is cut before the cutover.

## Closed since the last update

- **A fine could be charged twice.** A page read settled fines, splitting among
  whoever was scored so far, and `ledger_one_fine_idx` is per payer-payee pair,
  so a later split with more peers inserted the new shares beside the old ones.
  500 charged as 750, which is invariant 7 broken by a page load. Reads no
  longer settle, and `fine_postings` gives a fine one identity so a replay
  cannot write a second set of entries. `bun run check:money` reproduces it on
  the commit before.
- **Weekly streaks were wrong.** `streakOver` counts days and was handed one row
  per period, so three passed gym weeks reported a streak of 1 while grace was
  spent on weeks that had passed. A module says which of its days count now,
  and the counter is stored.
- **Grace no longer rewinds a streak.** A graced weekly failure rolled the run
  back to the value the week opened on, so the number fell while the app said
  grace protected it. A streak adds one or goes to zero, and grace makes it do
  neither.
- **verify covers the money**, and the nightly job runs it and records the
  result. It reports and never repairs, because a job that rewrites the rows
  every night erases the symptom while the cause runs on.
- **The reputation curve is quantised.** Carrying a stored `numeric(7,3)` score
  forward made its rounding an input, and a week of resumed closes drifted a
  thousandth from a replay. verify caught it on the first run of the
  incremental path.
- The v2.5 streak engine in `src/server/streak.ts` is gone: a second
  implementation with no grace, no schedule, and the type key hardcoded to
  "sleep". Nothing imported it. The name is now the real one.

- The complete-day stamp no longer keeps anything. It used to ask "has this day
  been stamped" and keep the answer in localStorage, which made it a state, and
  a state per browser: a second device stamped the same day again. It marks a
  moment now, firing on the check-in that finished the day and never on merely
  opening Home, so there is nothing to store and nothing to disagree across
  devices.
- `/checkin` and `/ledger` are gone, along with the folder the second one left
  behind. Both were v2.5 redirects rendering nothing, and nothing linked to
  either. The settle form and its action moved up to `src/app/`, beside the
  other shared components, since `/balances` and the group ledger tab both use
  them and the folder they lived in no longer has a page.

- **Nothing in the test suite exercises the real write path.** Still true, and
  still where the gym bugs lived, but both of those are now covered by domain
  tests that assert the declaration rather than the press.
- The nine undrawn routes: seven artboards plus the two signed-out states, all
  on a new `v3 Gaps` page, with a `pending-approval` fixture. `/signin` needed
  no fixture: it checks no session.
- Every route has a loading state shaped like its own destination and an error
  boundary of its own. Home moved into a `(home)` route group so its skeleton
  stops flashing on the way to everywhere else.
- **The harness error-page guard has fired.** Proven end to end by making a
  route throw on purpose: the guard reported `the app's error boundary
  rendered, not the screen` and the entry failed. It had never fired before.
