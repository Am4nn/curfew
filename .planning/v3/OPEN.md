# OPEN.md — what is not done

Everything known-open: defects, security gaps, work that needs a person, and
what is designed but not decided. Updated 2026-09-06.

`SCOPE.md` is the decision log; this file is the to-do list. When an item here
is settled it becomes a decision there and leaves this file.

---

## 1. Defects

**Five of the original six are fixed** (2026-09-06, commits `60ab7ec` and
`e79d5bf`). §1.6, the timezone stamp, is still open, and §1.7 was found while
building the consent-gate zone.

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

**More urgent than it was.** The mismatch bar on Home (decision 128) now offers
a zone change to anyone whose device disagrees, so a change that used to need
somebody to find the Settings screen is one press on the first screen they open.
This is the last of the six.

### 1.7 `tomorrow()` in `settings.ts` is a UTC day — OPEN

Found while building the consent-gate zone. Every effective-dated config write
lands on `nowUTC().plus({ days: 1 })`, which is the UTC tomorrow rather than the
member's. For anybody far enough east, a change saved late in their evening is
dated to what is already their today, and for anybody far enough west it lands
two of their days out. It is the same class as §1.2 and the fix is the same:
`userDay(userId)` plus one, which already exists.

Small, and it only ever moves a config change by one day in one direction. Not
fixed in the same commit as the gate, because it touches every config write and
deserves its own check.

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

### 7.1 Pause, for a trip — DESIGNED 2026-09-06, NOT BUILT

Decided and mocked. Decisions 133 to 137, seven artboards on the **v3.1 Pause**
page of the design canvas. No code yet, on purpose.

**The whole design is one sentence: a paused day is a day with nothing
scheduled.** Not a miss. Everything else falls out of that rather than needing a
rule: no fine can arise because nothing was scheduled to miss, and reputation is
not marked down because there was nothing to mark.

- **Every streak ends.** A streak is consecutive days, a pause is a gap, and
  grace does not cover one.
- **Reputation still settles** after seven quiet days, and that decay changes
  from a flat 3 a day to **1% of the score a day**.
- **No money**, which needs no rule.
- **Three days minimum, in advance, no quota.** One declaration covers every
  group and the personal record. The group sees it, with its dates.
- **Extend** while it runs. **Come back early** takes effect tomorrow; the days
  already passed stay paused and the streak that ended does not come back.

**What the numbers say**, from the real curve. A fourteen-day trip from 900 not
paused lands on 629 and takes **80 clean days** to undo. Paused it lands on 876
and takes **12**.

**Still to settle before it is built:**

- **Can you check in while paused?** The mocks say no: Home shows "Paused" and
  offers nothing, and coming back early is how you make a day count again. A
  paused day that somebody completed anyway still would not count, which is
  confusing enough that offering the button would be worse.
- **What a pause does to the settling window** (decision 54) for an activity
  added just before one.
- **The 1% decay is a change to `CONSTANTS`,** so it needs `LOGIC_VERSION`
  bumped, the 30 scenarios re-run and `REPUTATION.md`'s target properties
  re-checked. That is a separate commit from pause itself and can land first.

### 7.2 CI, and what it should gate — SETTLED 2026-09-06

All three questions are answered and built. Decisions 129 to 132.

- **The deploy workflow requires CI's own result for the tagged SHA.** It no
  longer runs its own shorter copy of typecheck and test, so a tag now carries
  the migration, security, simulation and dependency jobs it never did.
- **`simulate` and `verify` run on every push**, in their own job with their own
  Postgres. The whole CI run is about 90 seconds.
- **Unit tests were not the gap.** The domain is pure and well covered by 240 of
  them. The server layer is covered by the simulation and `break-in`, both of
  which need a database, and both now run on every push. That is the right
  shape: a unit test of `recomputeGroups` with a mocked database would test the
  mock.

**Still open in this area:**

- **`bun run lint` is new and there are two rules it does not enforce.** The two
  `useActionState` sheets keep a `setState` inside an effect, with the reason
  written above them: React gives no way to reset an action's result, so "the
  action finished" is only observable as a change to `state`. Revisit when React
  ships a reset.
- **`check:deps` reads the live npm registry**, so its job can go red on a
  morning nothing in the repo changed. That is why it is its own job and not
  part of `check`. If it turns out to be noisy, move it to a schedule.
- **Nothing checks GitHub Actions for deprecation.** `actions/checkout@v4` being
  on an EOL Node was found by a run annotation, not by a check.

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
