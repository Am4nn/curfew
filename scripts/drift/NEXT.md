# Next session

Last updated 2026-09-05, after the performance, loading/error and coverage pass.

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
- After that, a pass over all twelve activities, since the gym bugs were the
  kind only a real press finds.

### Performance, the half that is left

`closeOutstanding` now runs the scoring pass once a request instead of once per
tracked activity, which took Home from about 10.5 seconds to about 1.9. Nearly
all of what remains is that one pass, and it recomputes EVERY period from the
activity's first config date on every read. Twenty days of history costs about
a second; a year will not. Closing incrementally, from the last computed period
forward, is the fix, and it belongs with the engine verification above rather
than before it, because it changes what gets recomputed.

Nothing else measured above 0.2 seconds warm.

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
