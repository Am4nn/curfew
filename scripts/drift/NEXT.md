# Next session

Last updated 2026-09-05, after the check-in feedback work.

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

### The review gate

`SCREENS.md` is ticked by a person opening each screen beside its artboard, not
by the harness. Unticked on purpose: every Configure and Check-in row, plus the
four added for the check-in feedback (Recorded partial day, The day is
complete, and the two motion boards). The motion boards have no route and never
will: they are a spec for durations that live in `globals.css`.

### Coverage the harness does not have

- **Nine live routes have no artboard and so no drift entry**: `/balances`,
  `/ledger`, `/settings/personal`, `/settings/stored`, `/settings/rules`,
  `/checkin`, `/admin/reports`, `/admin/groups/[id]`, `/admin/users/[id]`.
  Four have v1/v2 boards in `.design/`, but those are the old design language,
  so pairing one against a v3 screen would report permanent drift. `/signin`
  and `/pending` also need a signed-out fixture the harness does not have.
  Roughly nine new artboards plus a fixture.
- **The error-page guard is unproven end to end.** `wrongPage()` checks for the
  error and not-found copy after every capture, which is the blindness that let
  a crashed Home pass. Two attempts to trigger it on purpose both timed out
  before the guard ran, because a dev error page never reaches `networkidle`.
  The guard is written and reviewed; it has never actually fired.

### Known, and deliberate

- **Per-commit `*.vercel.app` preview URLs cannot upload a photo.** Each
  environment's R2 bucket allowlists only its own domain, so a preview
  deployment that is not aliased to `dev.curfew.amanarya.com` fails the CORS
  preflight. Fixable by allowing the `*.vercel.app` pattern, at the cost of
  letting any deployment in the account write to the bucket. Left as is.
- **The complete-day stamp remembers it fired in localStorage**, per device.
  Clearing site data, or a second device, shows it again for the same day. It
  is a display and not a fact about the record, so it earns no event and no
  column (invariant 1), and showing twice is the harmless failure.

## Needs a person, not code

- `JURISDICTION.city` in `src/server/policy.ts` is a placeholder.
- The terms have not been read by a lawyer.
- **The production cutover.** Production still serves v2.5 from the old US
  Neon project while `vercel.json` pins `sin1`. That pairing is only safe
  because no tag is cut before the cutover.

## Closed since the last update

The four-item batch: back always goes back (shared `BackLink`, 14 files), every
photo list paginated (delete picker and the group evidence tab), Gym stops
offering a check-in that cannot count (`countsNow` on the module interface).

Then the check-in feedback, which replaced the receipt screen: a partial day
gets no overlay at all, and a complete day is stamped once. Both mocked,
reviewed, built and captured.

Also closed: the Home `+1` is optimistic now, `/settings/photos` paginates, the
seeded ledger spans real dates, and `V3Data` no longer promises a name removal
the app stopped doing.
