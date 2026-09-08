# OPEN.md — what is not done

Everything known-open: defects, security gaps, work that needs a person, and
what is designed but not decided. Updated 2026-09-08.

`SCOPE.md` is the decision log; this file is the to-do list. When an item here
is settled it becomes a decision there and leaves this file.

---

## 1. Defects

**All twelve are fixed.** The original six on 2026-09-05 and 2026-09-06
(`60ab7ec`, `e79d5bf`, `9abb998`), §1.7 found while building the consent-gate
zone (`12df57e`), §1.8 to §1.11 on 2026-09-07, and §1.12 on 2026-09-08.

### 1.1 Rejoining a group silently did nothing — FIXED

`acceptInvite` inserted the membership with `.onConflictDoNothing()`, so
somebody who had left already had a row and the invite was burned with nothing
happening. It could not be fixed without a decision, because decision 110 (a
rejoin starts fresh) and the copy on the group standing screen (rejoining does
not give you another grace day) disagreed. The copy moved. See §6 A.

### 1.2 The settling window was measured in UTC — FIXED

An activity's first `effective_at` was read in UTC while every other day in the
replay was the member's own, so a window opened a day early east of Greenwich.

### 1.3 `graceUsed` was a column that lied — FIXED

Written `false` on every row and rendered in admin. Grace has never protected a
fine (decision 5). Dropped in migration 0020.

### 1.4 Leaving a group made every page read a full replay — FIXED

`resumePointFor` expected every scope to be closed through the same day, and a
group somebody left stops at `left_at`. Each scope is now checked against the
day it is supposed to have reached.

### 1.5 Dead code — FIXED

`activeMembersOn` in `src/server/sharing.ts` had no callers.

Swept again 2026-09-07, properly: every exported name in `src/` counted against
every reference in `src/` and `scripts/`, with Next's file-based entry points
excluded and barrel re-exports not counted as uses. Thirty-two exports were
reachable from nothing, in two waves, because deleting the first wave orphaned
the second. 380 lines gone. Nothing imports a source file that is not a test,
and the count is now zero.

The one that mattered was `closeStreak`, the per-type streak close, sitting
beside the live `closeStreaks` and reading exactly like the thing that runs.

**Two of them were not dead code so much as an unbuilt feature**, and that is
worth keeping separate. `makeOwner` and `revokeInvite` in `src/server/groups.ts`
were written, tested by nothing, wired to server actions that no screen
imported, and `listGroupPendingInvites` beside them. So a group's owner could
not hand the group on, and nobody could cancel an invite they sent.

**Both were asked for and are built, 2026-09-08.** Two decisions were taken
first, because the deleted code answered neither:

- **An owner can be taken back down**, and a group refuses to reach zero owners.
  That is the rule `leaveGroup` already kept from the other side, and it makes a
  misclick recoverable rather than a job for SQL.
- **The sender or any owner can cancel an invite.** Any member can send one
  (`inviteToGroup` asserts membership and no more), so an owner-only rule would
  have left a member unable to undo their own typo.

It also closes a hole nobody had noticed: a sole owner with other members could
never leave, because `leaveGroup` refuses to leave a group ownerless and there
was no way to appoint anyone. Now there is.

Seventeen checks in `break-in` for the guards and eight in the browser suite for
the buttons. `SCREENS.md` records that neither block has an artboard.

### 1.12 The first thing you ever did counted for nothing — FIXED

Found while curating v3.1's raw ideas, from a request that read "make sure gym
gets an instant streak +1". It was worse than that: a new member's first gym
session left the streak at **0**, and it stayed 0 until the week ended.

`bumpStreak` has no stored row to add to the first time a type is counted, so
it rebuilds instead. The rebuild asks `activityDays`, which opened with

```ts
if (scored.length === 0) return { days: [], closedThrough: null };
```

and a member whose first period has not closed has no `activity_scores` row at
all. The early return threw away the in-flight days it was about to compute, so
the rebuild answered 0 and the press was lost.

The in-flight days are now computed before that case, and the case returns them
rather than nothing. `bun run check:streak` is new and runs in CI: six of its
eight checks fail on the commit before the fix, for gym and for office both, so
it was never only the weekly types. For a daily type the overnight close
repaired it, which is why it survived this long; for gym the week had to end.

**It was the first thing a new member ever saw.** Go to the gym, log it, and be
told nothing happened.

### 1.6 Timezone was resolved once and applied to all history — FIXED

`recomputeUser` resolved the member's zone for today and replayed every past
period in it, so moving country re-judged history. A fortnight of Kolkata
nights, all fourteen passed, came back as fourteen failures and a streak of
fourteen gone, for nothing the member did.

The research answer written down in `SCORING.md` was to stamp the local date on
every check-in, with a migration for old rows. That turned out to be both
unnecessary and insufficient, and the reasoning is recorded there. The fix is
that the zone is effective-dated config like a fine or a share, so it resolves
as it stood on the period being scored (invariant 5). Nothing new is stored.

Three replays were reading one zone: the period pass, the per-group pass, and
the streak rebuild. A fourth resolution, "the zone in force right now", cannot
be answered by a date at all, because the date depends on the zone; each row is
tested in its own zone instead. That one was a live bug of its own: a member who
picked their zone at the consent gate east of Greenwich was still being judged
in the seeded default until midnight in London, which is exactly what asking at
the gate exists to prevent.

### 1.7 `tomorrow()` in `settings.ts` was a UTC day — FIXED

Every effective-dated config write landed on `nowUTC()` plus a day. In
Kiritimati a change saved in the evening was dated to a day already being lived,
so it took effect at once and overwrote the row still in force, which is the one
thing invariant 4 exists to stop. In Midway it landed two days out. Three writes
had it: the personal settings, the sleep windows, and a group's fine rule, which
was also reading the process clock rather than the app's.

`bun run check:timezones` covers §1.6 and §1.7 together, at UTC+14 and UTC-11.
Six of its thirteen checks fail on the commit before the two fixes.

### 1.8 The nightly job ran before last night was scorable — FIXED

`vercel.json` scheduled `0 4 * * *`, which is 9:30 AM in Kolkata. A sleep night
runs local noon to noon, so at 9:30 the night that had just passed was still
open, and the run scored the night before it. Monday's fine posted on Wednesday
morning: about thirty six hours after the morning it was owed, against a
decision that says the following morning.

Nothing showed it. Every screen was right, because a read closes periods lazily;
only the ledger and the reputation rows lagged, and both are correct as soon as
the next run reaches them. It was found by working out when the last default
window closes and comparing that with the schedule, which is now
`bun run check:cron` in CI: it asks each of the twelve modules, at its own
defaults, when yesterday becomes scorable, and fails if the run fires first.
Sleep fails on `0 4`. The schedule is `0 7 * * *`, 12:30 PM in Kolkata, the
earliest half hour after a noon boundary can close.

**One daily cron is wrong for somebody whatever it is set to**, and this one is
set for the zone the members are in. A member far enough west is scored a day
late, which the job repairs on its next run because it scores every unscored
date rather than only yesterday's.

### 1.9 The optimistic count outlived the render it described — FIXED

A counter's row on Home goes optimistic on the press: it shows `nextStatus`,
the module's own line as it would read once one more press lands, so the number
moves without waiting for the round trip. `nextStatus` is only ever true of the
render that was on screen when the button went down, and the row went on
substituting it for the whole four seconds the mark is held, which is long
after the server's own render has arrived with the press already counted. A
fourth glass of water read:

```
4 of 8  ->  5 of 8  ->  6 of 8  ->  5 of 8
```

Nothing stored was ever wrong, which is why nothing caught it. The unit tests
see the module's two sentences and both are correct. `verify` sees the events
and they are correct. Only a browser holding the row through the refresh sees
the wrong one, so the fix comes with `scripts/browser/counter.mjs`, which
presses the button and samples the line for six seconds. Four of its six checks
fail on the commit before the fix.

The same substitution was wrong on the other path into that state. A check-in
made on `/checkin/<key>` returns to `/?done=<key>`, and that render already
counts the press, so there was never anything to be optimistic about there.

**Gym is the one type it could not affect**, which is worth recording because
gym is where it was reported. Only one session a day counts, so gym's step
closes after a press, `nextStatus` is null, and the row falls through to the
server's line. Water, food and every other counter had it.

The two states are now two flags. `recorded` is a moment and lasts four
seconds; `optimistic` lasts until the server's status differs from the one that
was on screen when the press was made.

### 1.10 `verify` called a member's own today a day from the future — FIXED

Found by the fix above: the admin suite's drift check started failing for a
different member every run. §8's rule again, from the other side. The check
that reports a stored reputation row for a day that has not happened compared
each row against the end of the REPLAY, and admin Ops verifies a window ending
on a UTC date. At half past one in the morning in Kolkata that window ends
yesterday, so every member's row for the day they were living was dated after
it and reported as a row from the future.

Three things were wrong and all three are fixed. The check now measures against
the member's own `userDay`, which is window-independent and is what "has not
happened" means. Ops takes its window from the admin's own day rather than from
UTC. And the drift row carries its own field rather than borrowing the one the
missing-row case uses, which had the report describing a row from the future as
a row that was never stored: the exact opposite of what it is.

The check still catches what it was written for. A reputation row dated three
days out is still reported, now as `ahead`.

### 1.11 A check-in could be filed under the wrong day — FIXED

§1.6 fixed the resolver and converted the callers it was written for. Nine
others were left asking the old question, and they are the ones on the path a
person actually walks:

```ts
await resolveUserTimezone(userId, instant.toISOString().slice(0, 10))
```

That reads the zone in force ON THE UTC DAY. A member's first zone is dated
from their own today, and east of Greenwich that is a date UTC has not reached,
so the row is invisible and everything downstream is computed in the seeded
default. `getCheckinState` drew the wrong windows and `performCheckin` filed
the press under the wrong period. Measured at UTC+14: the board and the press
both landed on 2026-03-10 while the member was living 2026-03-11, a whole day
out, which is a day that passes or fails on the wrong evidence.

Two of the nine carried a comment saying "the user's own date, not UTC"
directly above the line that read the UTC one.

The nine: `getCheckinState` and `performCheckin` (`checkin.ts`),
`listUserActivities` and `trackType` (`activities.ts`), both grace resolvers,
the pause sweep, and both stats readers. All now ask
`(await timezoneHistory(userId)).at(instant)`, which tests each row in its own
zone. `bun run check:timezones` gained a third section for it and fails twice
on the commit before.

Two dates written from UTC went with them. `leftAt` was stamped
`new Date().toISOString().slice(0, 10)` both when an admin disables an account
and when a person deletes their own, so somebody leaving at 2 AM in Kolkata was
marked gone on a day they had already finished living. A group counts its
members by date. Both now use `userDay`.

**Where the same pattern is deliberate and was left alone.** `r2.ts` signs with
`new Date()` because AWS SigV4 needs the real wall clock and a scrubbed preview
clock would have the signature rejected. `sweepEvidence` compares retention
dates against the UTC day, which for a sweep across every member has no single
zone to use, and errs towards deleting a photograph late rather than early. The
app-settings resolvers read `new Date()` rather than the app clock, which only
differs under a preview clock scrubbed BACKWARD, and nothing does that.

---

## 2. Security

`bun run break-in` holds everywhere it can reach, on every push in CI. 118
checks with a server to sweep, 103 without, and the new `browser` job means CI
now runs the first number rather than the second.

**What it still cannot say:**

- **Server actions are not reachable over HTTP as a forged request.** Next mints
  their ids at build time, so forging one tests Next rather than Curfew. Each
  action's guard is called directly instead. The new browser suite narrows this
  from the other side: it presses the real buttons in a real browser, so an
  action wired to the wrong guard now fails somewhere.
- **No authenticated-as-somebody-else request in a real-auth environment.** That
  needs a forged Better Auth session. The LOCAL_MODE sweep covers the same
  ground with a fixed identity, which is why the positive control matters.
- **Nothing checks the R2 bucket policy.** `check:cors` answers one narrow
  question about uploads and says nothing about who else can read the bucket.
  The security headers are covered now: `next.config.ts` sets six on every
  route and the HTTP sweep asserts five of them against a real response.
  There is still **no Content-Security-Policy beyond `frame-ancestors`**,
  because App Router emits inline bootstrap scripts and a real policy needs a
  per-request nonce through middleware. A wrong one is a blank page rather than
  an error, so it is worth doing deliberately and not in a cutover week.
- **RLS is still deferred** (`../BACKLOG.md`), so the query layer is the only
  wall. One missing `assertMember` is a breach rather than a defence-in-depth
  miss.
- **The rate-limit ceiling only runs where Upstash is configured.** `rateLimit`
  fails open by design when it is unreachable, so the round skips that check
  rather than reporting a pass it did not earn. It held against preview,
  refusing the 21st press in a minute.

**A caution recorded on purpose.** Three checks were wrong before they were
right in the session that wrote them: one summed a ledger row an earlier round
had left behind and reported a double-charge that was the fixture's; one
compared a count against zero and so could not fail; and a run meant to prove
the CI shape was quietly reading `.env.local`. A green round is evidence, not
proof.

---

## 3. Not tested yet

- **Photo evidence end to end** through a real camera in a real browser:
  capture, compression, the presigned PUT, the check-in as the callback. The
  browser suite opens the camera screen; it cannot hold a phone up to it. This
  is the last item on this list that only a person can close.

Two things that were on this list are now covered by `bun run browser`, which
runs in CI:

- **Balances and settlement as screens.** The suite types an amount into the
  settle form and asserts the debt is one rupee smaller afterwards.
- **Admin console actions over HTTP.** It changes an app-wide setting through
  the console's own confirm sheet, asserts the change, puts it back, and runs
  both Ops primitives with the drift report as the assertion.

---

## 4. Needs a person, not code

- **The terms have not been read by a lawyer.**
- **The `SCREENS.md` review gate**: somebody opening each screen beside its
  artboard and ticking the row. What is left of it is the ticking. Round 5 of
  the drift audit (`scripts/drift/REPORT.md`, 2026-09-06) captured all eighty
  pairs, including the fifteen v3.1 boards that had never been in the gallery
  at all, and lists every difference it found: four were bugs and are fixed,
  the rest are named as fixture or as deliberate. Open `.shots/index.html`
  after `node scripts/drift/run-all.mjs`.
- **Two artboards still have no pair.** `V31StandingImmaculate` and
  `V31StandingClimbing` need a spotless fixture: sixty days with nothing
  missed, which means a longer history than the current 45 and a perfect
  variant of all six event seeders. The numbers behind both bands are covered
  by the simulation; the gold halo, the only glow in the app, is not.

`JURISDICTION.city` is settled: Bengaluru, confirmed 2026-09-06. The value was
already there and only the comment beside it still called itself a placeholder.

---

## 5. The cutover, and after it

Settled 2026-09-07: **nothing is carried across.** Decision 22 stands, the two
databases have different schemas anyway, and the people affected are three. The
old `curfew` project is deleted rather than migrated, and `curfew-apac` is
emptied before it becomes production. The steps are in `PLAN.md`.

- **Production still serves v2.5** from the old Neon project. `.env.production`
  is the only file pointing at it, and at the cutover its two database values
  become the APAC ones.
- **`vercel.json` pins `sin1` while production's database is still in
  `us-east-2`.** Safe only because no tag is cut before the cutover.
- **The 19 v2.5 artboards** in `.design/` come out once the cutover is done.
- **Preview has never been scored.** Vercel crons run on production deployments
  only, and preview is a Preview deployment, so the nightly job has never fired
  there. `bun run score` writes them by hand, and it writes fines, which are
  append-only ledger rows, so it is a deliberate act rather than housekeeping.
  After the cutover, dev runs against the `curfew-apac-dev` branch and is
  scored the same way, by hand, when a scored number is what is being looked at.
- **One Upstash database serves both**, accepted 2026-09-07: the free tier
  allows one, and only developers reach the dev deployment. The keys carry no
  environment (`src/server/ratelimit.ts`) and the dev branch is a clone, so the
  same person's counter is shared across the two. Both ways that can go are
  safe. A developer flooding as themselves spends their own ceiling and nobody
  else's, because the key is per user. And when the free tier throttles the
  account, `rateLimit` fails OPEN by design, so the ceiling stops being enforced
  rather than locking anyone out. Seen here: two `break-in` runs back to back,
  and the second reported "never refused" where the first said "after 21". A
  rate-limit check that goes red straight after another run is that, not a
  regression.

---

## 6. Decided 2026-09-05, built

**A. A rejoin is a fresh start with a fresh grace day, and the money follows
them back.** New `joined_at`, `left_at` cleared, the score starts from the
global score again (decision 110), and the group does not count the day they
rejoined (decision 123). What they owed and were owed comes back with them,
which falls out of the model: `ledger_entries` is append-only and leaving never
deleted anything.

**B. `grace_used` goes.** Migration 0020, and the "· grace" label with it.

**C. All of the smaller defects**, §1.2 and §1.4 through §1.7.

**D. A pause is three days or more.** Enough for a weekend trip.

---

## 7. Built since

### 7.1 Pause, for a trip — BUILT 2026-09-06

Decisions 133 to 137, mocked on the **v3.1 Pause** page of the canvas, shipped,
and migrated to preview.

**The whole design is one sentence: a paused day is a day with nothing
scheduled.** Not a miss. The code is arranged so that sentence is the only rule.
There is no rule that a pause waives a fine, and none that it spares reputation:
the period is scored and stored with a `paused` flag the way `settling` already
works, the group pass never sees it so no outcome row exists to charge from, and
the global pass reads the day as one on which nothing concluded, which is the
branch that already handles a Sunday nobody scheduled.

- **Every streak ends**, when the first paused day closes rather than when the
  pause is declared, and grace is never consulted.
- **Reputation still settles**: six quiet days, then the idle decay from the
  seventh.
- **Three days minimum, in advance, no quota.** One declaration covers every
  group and the personal record.
- **A period is paused only when every day of it is inside one**, which is what
  stops a three-day pause erasing a whole gym week.
- `user_pauses` is insert-only, in the family of invariant 4.

**Proved rather than asserted.** Four simulation scenarios, and the flag was
broken on purpose to watch them fail: the days stop being marked, four fines
appear, and grace gets spent, which is the one that shows the streak really does
bypass it. `break-in` section 20 covers the back-dating attack with a positive
control. Twenty-one browser checks drive the real screens through the mock
clock, including day one saying "Running until tonight" and day three saying
"Ended".

**Stats now say so too.** A paused day produces no period, so a declared trip
and a fortnight of not turning up drew the identical hole. An away day is drawn
rather than left blank, in the legend and named with its dates, and group stats
says who is away above the numbers those days are missing from. Mocked as
`V31StatsPaused` and `V31GroupStatsPaused`.

**Still open:**

- **A pause does not stop the settling window** (decision 54) for an activity
  added just before one. Settling is about the activity being new, not about the
  member being present, so a trip does not extend it. Recorded rather than
  argued.
- **The mock and the build differ in one place.** The declare form has no `min`
  on its end date: it could only be computed from the start date as it stood on
  the server, so it lies the moment somebody picks a later one, and a wrong
  `min` blocks a valid submission with no message at all. The length rule is the
  server's, where it can say what it wants.

### 7.2 CI, and what it should gate — SETTLED 2026-09-06

Decisions 129 to 132, and the gaps in them closed the same day.

- **The deploy workflow requires CI's own result for the tagged SHA**, so a tag
  carries every job CI runs, including the new ones.
- **`simulate` and `verify` run on every push**, in their own job with their own
  Postgres, and now `check:money`, `check:logic-version` and `check:timezones`
  beside them: three narrow proofs that each exist because the thing they check
  went wrong once, and each of which ran by hand until now.
- **A `browser` job** builds a database of its own, starts the app and runs the
  seventy-nine browser checks plus the full security round, HTTP half included. It
  runs a dev server on purpose: LOCAL_MODE is gated on `NODE_ENV` not being
  "production" and `next start` sets exactly that.
- **`check:actions`** asks of every `uses:` line whether the repository is
  archived and whether the pinned major is behind the latest. It found
  `actions/checkout@v5` against a released v7 on its first run.
- **Unit tests were not the gap.** The domain is pure and well covered by 242 of
  them. The server layer is covered by the simulation and `break-in`, both of
  which need a database, and both of which run on every push.

**Still open in this area:**

- **`bun run lint` has two rules it does not enforce.** The two `useActionState`
  sheets keep a `setState` inside an effect, with the reason written above them:
  React gives no way to reset an action's result, so "the action finished" is
  only observable as a change to `state`. Revisit when React ships a reset.
- **`check:deps` and `check:actions` read live registries**, so their job can go
  red on a morning nothing in the repo changed. That is why they are their own
  job and not part of `check`. If it turns out to be noisy, move it to a
  schedule.

---

## 8. Found while fixing the above

Three fixtures were measuring themselves rather than the app, and all three
went green for the wrong reason until something moved:

- Two timezone scenarios started four people in four zones at one shared
  instant, so they began on different local dates. `trackIn` starts each at
  their own local midnight.
- `break-in` dated its world in UTC and compared that against a period the
  server had resolved in the member's zone, so it reported a hole of its own at
  half past midnight in Kolkata.
- The simulation pins `TODAY` as a constant while the engine reads the real
  clock. The day the real date moved past it, every scenario's last check-in
  landed the day before yesterday and a spotless record spent grace on the gap.
  The scenario phase now pins the clock.

A fourth, from the browser suite: the first version of a browser check went
green five times against the pending-approval screen, because a simulation had
wiped the database out from under it and every route redirected. `open` in
`scripts/browser/run.mjs` refuses that screen by name for exactly that reason.

A fifth, the other way round. `check:logic-version` failed and the check looked
wrong: one ordinary scoring pass had not restored the score it stamped. It had.
The row it sampled was dated three days into the future, left there by the
browser suite scrubbing the preview clock into a trip, and the pass at the real
clock was never going to reach it. `verify` could not see those rows either,
because it only ever compared inside the range it computed, and they are not
harmless: `resumePointFor` reads the last stored day as the balance to carry
forward, so it would resume from the far side of the gap and skip every real
day in between. Both are fixed. The lesson is the same as the other four, with
the sign flipped: a check that goes red for a reason that sounds like the app
is worth suspecting too, and this one was right.

A sixth, and the worst of them, 2026-09-07. CI reported

```
ok    /activities renders  ACTIVITIES This did not load. Nothing was changed.
```

`_route-error.tsx` renders inside the layout and with a 200, so a route that
threw still carries its heading and its nav. The check looked for the heading,
found it, and went green over a screen that had not loaded. The only thing that
gave it away was a console error, and that error was Next failing to serialise
the real one, so what the run actually reported was the error handler's error.

Three things came out of it. `open` refuses the error boundary by name, the way
it already refuses the pending-approval screen, and retries once first because a
dev server compiling a route can throw once and serve it correctly a moment
later. CI prints the dev server's log when the browser job fails, which it never
did, so a route that throws in CI and renders locally could not be diagnosed at
all. And the suite stopped sleeping: it acted, waited a fixed 2.5 seconds and
read once, which is long enough on a warm machine and not always long enough on
a CI runner. That is what the pause suite's "declaring lands on the declared
state" was failing on, and it fails nowhere now that every post-action read
polls for what it expects by name.

The `/activities` throw itself was not reproducible: the same commit re-run
rendered it correctly, and it renders on a from-empty database locally. It is
still unexplained, and the guard is what makes the next occurrence say so
loudly instead of passing.

`frame.join is not a function` is now filtered as noise alongside the failed
asset fetches, which is a deliberate trade and not a shrug. It is thrown inside
Next's `buildFakeCallStack`, so the console gets the error handler's error
rather than the error it was handling, and there is nothing in it to act on. It
is only safe to ignore because the boundary guard above catches the thing it
used to stand in for, and catches it by name.

The pattern is the same each time: a test that passes because it is looking at
the wrong thing, and only says so when something else changes. Worth suspecting
first the next time a check goes red for a reason that sounds like the app.
