# OPEN.md — what is not done

Everything known-open at the end of the 2026-09-05 session: defects, security
gaps, work that needs a person, and two things to talk through before they are
designed. Nothing here is being implemented yet.

`SCOPE.md` is the decision log; this file is the to-do list. When an item here
is settled it becomes a decision there and leaves this file.

---

## 1. Defects

**Five of the six are fixed** (2026-09-06, commits `60ab7ec` and `e79d5bf`).
Only §1.6, the timezone stamp, is still open.

### 1.1 Rejoining a group silently does nothing — FIXED

**Proved, 2026-09-05.** `acceptInvite` (`src/server/groups.ts`) inserts the
membership with `.onConflictDoNothing()`. Somebody who has left already has a
row, with `left_at` set, so the insert does nothing while the invite is still
marked accepted. The invite is burned and the person is not in the group, with
no error anywhere.

```
invite status : accepted
joined_at     : 2026-08-01
left_at       : 2026-09-05
STILL OUT: the invite was consumed and nothing happened
```

**It cannot be fixed without a decision**, because two things that are already
written down disagree:

- Decision 110 says a rejoin **starts fresh** from the current join date.
- Decision 123's grace period keys off that join date, and the copy on the
  group standing screen says "Once, on the day you join. Rejoining does not
  give you another."

Setting a new `joined_at` satisfies 110 and hands out a second grace day, which
contradicts the copy. Not setting one contradicts 110. One of them has to move.

**Settled: the copy moves.** See §6 A.

### 1.2 The settling window is measured in UTC — FIXED

`src/server/scoring.ts:120` reads an activity's first `effective_at` in UTC
(`{ zone: "utc" }`) while every other day in the replay is the member's own.
Someone in Kolkata who adds an activity at 2 AM gets a settling window that
starts on the previous day, so it ends a day early and the seventh day counts
when it should not.

Small, and it only bites for the first week of a new activity. The fix is to
read that instant in the member's zone, the way `userDay` now does.

### 1.3 `graceUsed` is a column that lies — FIXED

`activity_outcomes.grace_used` is written `false` on every row by
`recomputeGroups`, and `src/app/admin/users/[id]/page.tsx:137` renders "· grace"
off it. Grace has never protected a fine (decision 5), so the column has never
had a true value and never will as things stand.

**Settled: the column and its label go.** See §6 B.

### 1.4 Leaving a group makes every page read a full replay — FIXED

`resumePointFor` (`src/server/scoring.ts`) refuses to resume unless every scope
is closed through the same day. A group a member has left stops at `left_at`,
the global score runs to today, so they never agree again and every read replays
that user's whole history from their join date.

Correctness is unaffected. It undoes the performance work of the caching pass
for anybody who has ever left a group. The fix is to expect a left group to end
at `left_at` rather than at today.

### 1.5 Dead code — FIXED

`activeMembersOn` in `src/server/sharing.ts` has no callers.

### 1.6 Timezone is resolved once and applied to all history — OPEN

Already recorded as an open question in `SCORING.md`. `recomputeUser` resolves
the member's zone for today and replays every past period in it, so moving
country re-judges history. The research answer is to stamp the local date on
each check-in as it is recorded: a payload field, a migration for old rows, and
the replay reading it.

---

## 2. Security

`bun run break-in` holds everywhere it can reach, on every push in CI. 110
checks against preview with a server to sweep, 90 against docker, 72 in the CI
shape. Nothing broke. What the round covers is written up in `TRUST-SAFETY.md`.

**What it still cannot say:**

- **Server actions are not reachable over HTTP.** Next mints their ids at build
  time, so forging one tests Next rather than Curfew. Each action's guard is
  called directly instead, which catches a missing guard but not an action
  wired to the wrong one.
- **No authenticated-as-somebody-else request in a real-auth environment.** That
  needs a forged Better Auth session. The LOCAL_MODE sweep covers the same
  ground with a fixed identity, which is why the positive control matters.
- **Nothing checks the R2 bucket policy, the security headers, or the
  dependencies.** `check:cors` answers one narrow question about uploads.
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

- **Photo evidence end to end** through a real camera in a real browser: capture,
  compression, the presigned PUT, the check-in as the callback.
- **Balances and settlement as screens**, rather than as the functions behind
  them. `recordSettlement` and its guards are covered; `/balances` and the
  settle form are not.
- **Admin console actions over HTTP.** Their capability gate is covered
  directly; the routes are only covered signed out.

---

## 4. Needs a person, not code

- **`JURISDICTION.city`** in `src/server/policy.ts` is still a placeholder.
- **The terms have not been read by a lawyer.**
- **The `SCREENS.md` review gate**: somebody opening each screen beside its
  artboard and ticking the row. Configure and Check-in are unticked on purpose.

---

## 5. The cutover, and after it

- **Production still serves v2.5** from the old Neon project. `.env.production`
  is the only file pointing at it, and at the cutover its two database values
  become the APAC ones.
- **`vercel.json` pins `sin1` while production's database is still in
  `us-east-2`.** Safe only because no tag is cut before the cutover.
- **The 19 v2.5 artboards** in `.design/` come out once the cutover is done.

---

## 6. Decided 2026-09-05, to build next session

All four are built. What follows is what was decided and what it turned into.

**A. A rejoin is a fresh start with a fresh grace day, and the money follows
them back.** New `joined_at`, `left_at` cleared, the score starts from the
global score again (decision 110), and the group does not count the day they
rejoined (decision 123).

What they owed and were owed comes back with them. That falls out of the model
rather than needing work: `ledger_entries` is append-only and leaving never
deleted anything, and `/balances` hides a group only because `getUserGroups`
filters on `left_at is null`. Clearing it makes the debts visible again. **The
fix must not touch the ledger**, and there should be a check that says so.

The copy on the group standing screen changes: it currently reads "Once, on the
day you join. Rejoining does not give you another", which is now wrong.

**B. `grace_used` goes.** A migration drops the column and the "· grace" label
in `src/app/admin/users/[id]/page.tsx` goes with it. Grace has never protected
a fine (decision 5), so the column has never had a true value.

**C. All four of the smaller defects**, §1.2, §1.4, §1.5 and §1.6. The
timezone stamp (§1.6) is the large one of the four and carries a migration.

**D. A pause is three days or more.** Enough for a weekend trip. Everything
else about it is still open, in §7.1.

---

## 7. To talk through, next session

These are not designed. They are the two things to open with.

### 7.1 Pause, for a trip

A member who is deliberately away says so, and while paused:

- **Streaks do not break.** The days are not misses.
- **No money.** The group does not fine them for a period they declared out of.
- **Reputation: TBD.** The three plain options are that it freezes, that the
  days read as "nothing scheduled" and drift after a week the way idle days
  already do, or that it keeps counting and a pause only buys the streak and the
  money. Freezing is closest to what the word means; drifting is closest to what
  the curve already does.

**Open questions to settle before any of it is built:**

- **A minimum length: three days.** Settled 2026-09-05. Enough for a weekend
  trip, and not usable as a one-night excuse.
- **Declared in advance, or after the fact?** Declaring afterwards is a way to
  erase a miss that has already happened, which is the same exploit un-sharing
  was closed against (decision 15). Almost certainly it has to be in advance,
  and then a trip that gets extended is its own case.
- **How many a year, and who can see it.** A pause the group cannot see reads as
  a member being let off, which is the same reasoning that put the grace period
  on the members list (decision 123).
- **Does a pause interact with grace?** Both protect a streak. They must not
  stack into a way to never miss.
- **Can it be cancelled?** Coming home early should probably end it, and ending
  it early must not retroactively judge the days already passed.

The join grace period is the precedent for all of this: one boundary in
`recomputeGroups`, visible to the whole group, and it gates the outcome rather
than being subtracted afterwards.

### 7.2 CI, and what it should be allowed to gate

Three separate questions that arrived together.

**Production should not deploy unless CI passes.** Today `deploy.yml` runs on a
tag and does its own typecheck and test inline; `ci.yml` runs on push and pull
request. They are two lists that can drift. The obvious shape is for the deploy
workflow to require the CI workflow's result for that commit rather than
repeating a subset of it.

**Should CI run everything?** It now runs typecheck, test, build, the migration
job and `break-in`. The candidates not in it are `bun run simulate` (30
scenarios, ~2 minutes, needs a database, and it is the only thing that would
catch a change to the curve) and `bun run verify` against a seeded database.
Both are integration tests in everything but name. The question is which of them
is worth the minutes on every push, and which belongs on a tag.

**Should unit tests be enhanced?** There are 232 domain tests and they cover the
domain well, because the domain is pure. What has no unit tests at all is the
server layer: `scoring.ts`, `streak.ts`, `ledger.ts`, `grace.ts` and
`clean-run.ts` are exercised only by the simulation and by `break-in`, both of
which need a database. Whether that is a gap or the right shape is worth
deciding on purpose rather than by default.

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

The pattern is the same each time: a test that passes because it is looking at
the wrong thing, and only says so when something else changes. Worth suspecting
first the next time a check goes red for a reason that sounds like the app.

**The design canvas is one publish behind.** `.design/build-v3.mjs` carries the
new grace copy and `.design/` is gitignored, so the published artboard still
shows "Rejoining does not give you another" until somebody republishes it.
