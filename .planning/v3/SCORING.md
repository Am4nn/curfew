# Streaks, reputation and money

How the three numbers are produced, when each one moves, and what stops them
being wrong. Written after a read of the built code and a round of research
into how other systems solve the same three problems.

Supersedes nothing. `REPUTATION.md` still defines the curve; this says where
the number lives and when it is touched.

## The three clocks

They are not the same kind of number and they must not share a schedule.

| | Moves | Why then |
|---|---|---|
| Streak | the moment you press | It is a count of things you did. Nothing else has to happen for it to be true. |
| Reputation | day close | It is a fraction of a day. A day that is 1 of 3 done is not a result yet. |
| Money | nightly, after everyone is scored | A fine is split among the members who passed. You cannot know who passed until their windows shut too. |

The mistake in the built version is that all three are produced by one function,
`recomputeUser`, which replays every period since the join date, and every page
read calls it.

## What is wrong today

1. **Weekly streaks are wrong.** `standingFor` hands `streakOver` one row per
   period. A weekly type arrives as a single Monday, which is below its own
   `perWeek` minimum, so the week reads as failed. Three passed gym weeks return
   a streak of 1, and grace is spent silently on weeks that passed.
2. **A fine can be charged twice.** The read path writes fines. It splits among
   the peers scored so far, and the unique index is per payer-payee pair, so a
   later split with more peers inserts additional rows instead of replacing the
   posting. A 500 fine can become 750. That breaks invariant 7.
3. **Every page read replays all history**, and the group pass issues four
   queries per day per group inside that loop.
4. **`verify` does not cover money.** It diffs `activity_scores` and
   `reputation_daily`. It never reads `activity_outcomes` or `ledger_entries`.

## What the research says

Three patterns, all of them the same shape, all of them agreeing with the
instinct that a page read should be a get.

**A streak is a cached counter over an immutable log.** The Duolingo-style
build stores `current_count`, `longest_count`, `last_activity_at` and the
timezone as a derived cache, writes the activity to an append-only log, and
guards the first-of-day increment with a unique constraint on `(user, day)`.
The log is what lets the counter be rebuilt when the logic changes or a bug is
found. The counter is never the truth; it is the fast answer.

**Closing the books.** The accounting pattern for a running total: at the end
of each period, summarise and carry forward only what the next period needs,
the opening balance. The next period opens from that record rather than from
the start of history. Full history stays for audit, and closed periods are
traversed only when auditing. This is the direct answer to "why recompute every
time": you do not, you carry the balance.

**A posting is idempotent as a whole, not row by row.** The ledger rule is to
derive the idempotency key from the source event and put a unique constraint on
the posting, so a replay cannot write a second set of entries. Balances are the
sum of the rows; a cached balance is derived data. Corrections are reversing
entries, never edits.

One warning worth repeating: reconciliation treated as an incident procedure
rather than a scheduled one means drift accumulates undetected until an audit
forces it. That is the argument for `verify` running nightly and covering
everything, not for dropping the replay.

## The design

### Streak: a counter, closed weekly

One row per user per type, and it is the week's closing record as well as the
counter:

```
activity_streaks                            (migration 0019)
  user_id, type_key            primary key
  current            int       the run that is still alive
  best               int       never taken back
  last_day           date      the last activity-day counted
  week_start         date      the week week_sessions belongs to
  week_sessions      int       days done in the week in flight
  grace_spent        jsonb     { "2026-09": 1 }
  closed_through     date      every day up to here is accounted for
```

**No day log beside it.** The plan called for a `(user, type, day)` table of
days done, and it is not needed: `events` already is that log, with
`events_one_checkin_idx` unique on user, type, period and idempotency key. A
second table would be derived state with its source of truth sitting next to
it, which invariant 1 says to say so about rather than add. The press is
idempotent because the event insert is.

**A module says which of its days count.** `daysDone` on the module interface,
defaulting to "the period, if it passed", which is right for eleven of the
twelve. Gym declares its own, because only gym knows that two presses on a
Tuesday are one day at the gym (invariant 6). This is the piece that was
missing: the engine was guessing by handing the streak one row per period.

A press adds the days it completed, which is what counts now minus what counted
a moment ago. Water's eighth glass adds one and the first seven add nothing.
Decision 77 stands: days add as they happen, so a six-session week adds six.

**A streak only ever does `+1`, or goes to `0`. Grace means it does neither: it
holds where it is.** There is no third movement, and in particular nothing
rolls it back to an earlier value. A number the user watched climb must not
fall while the app tells them grace protected them.

At close (nightly, or lazily on the first read of a new day):

- Daily type: a scheduled day with nothing done spends grace and holds, or
  resets `current` to 0.
- Weekly type: if the week reaches `perWeek` it stands. If not, grace holds
  `current` where it is, keeping the days that week added, or it resets to 0.

This changed the built `streakOver`, which rolled a graced weekly failure back
to the value the week opened on. Nothing returns to an earlier value now, and
there is no column for one.

A graced short week therefore leaves the user ahead by the days they did do.
Grace is capped per month, so it cannot be farmed.

`closed_through` is what makes the close idempotent and lets a missed night
catch up without double counting.

**The close rebuilds rather than stepping forward**, and that is deliberate. A
weekly streak is judged at week end against days spread through the week, so
stepping forward from a mid-week boundary would carry the week's partial state
and the grace it might spend, which is the walk `streakOver` already does
correctly in one place. A rebuild reads two tables for one type and runs at most
once per activity-day, because `closed_through` says when there is nothing to
do.

**The rebuild counts the period in flight too.** `verify` caught this: the press
counts a day as soon as it is done, and a rebuild that only looked at closed
periods reported one lower every evening. Only days that ARE done are added,
never a day merely not done yet, because a day still in progress has not been
missed and marking it so would end a run at breakfast.

**Read path: one row, no arithmetic.**

### Reputation: carry the balance

`reputation_daily` already has a row a day. It is already a closing record; it
is simply never used as one. The change is that the daily pass reads yesterday
and applies today's delta, rather than replaying from the join date.

```
yesterday = SELECT score FROM reputation_daily
            WHERE user, scope, day = today - 1
today     = applyDay({ score: yesterday, ceiling, completion, idleDays })
```

`applyDay` is unchanged. `replay()` is unchanged and is what `verify` uses.

Two things to get right, both of which the snapshot literature warns about:

- **The carried number must be invalidated when the logic changes.** A stored
  score computed by an older `applyDay` is silently wrong. `reputation_daily`
  gains a `logic_version` column, bumped whenever the curve constants or
  `applyDay` change, and the incremental path refuses to carry a row whose
  version does not match, falling back to a replay for that user.
- **A gap must not be skipped.** If yesterday's row is missing, the day cannot
  be carried and the user is replayed. That is the correct behaviour for a new
  member, a missed night and a restored backup alike.

A third case appeared in the building: **the scopes must agree on how far they
got.** A group closed to Tuesday and the global score closed to Friday cannot
share one resume day, and resuming the group from Friday would silently skip
two days. Rare, and a full replay is the right answer to it.

And one thing the literature warns about that had to be met head on. **The
stored score is the state, not a picture of it.** `score` is `numeric(7,3)`, so
a stored day is rounded. While the whole curve was replayed every time, that
rounding was a display detail: the replay carried full precision day to day and
rounded once, at the end. Carrying the stored value forward makes the rounding
an input, and continuing from 214.994 is not continuing from 214.9944. A week
later the two answers differ by a thousandth, which is exactly what `verify`
reported on the first run of the incremental path. Three decimals is the value
now, quantised every day inside `applyDay`, so the stored row IS the state and
an opening balance is exact.

**Read path: the latest row, no arithmetic.**

Whether reputation moves per group at day close or in one pass: one pass. The
group scores share the day's facts and differ only in ceiling and which types
count, so they close together.

### Money: one posting, once, after the close

Three changes.

**The read path stops writing fines.** `closeOutstanding` passes
`fines: false`. Money is written by the nightly job and by nothing else. This
alone removes the double-charge, because the nightly job already scores
everyone before it settles.

**A fine becomes a posting with one identity.** A new table:

```
fine_postings                                       (migration 0017)
  group_id, type_key, period_start, from_user_id   primary key
  amount, currency, posted_at
```

The posting is claimed FIRST, then the shares are written. If the posting row
conflicts, the fine is already charged and the whole split is skipped,
including any share that does not yet exist. That is the "unique constraint on
the posting" rule, and it is what the per-payee index fails to give.

**Not one transaction, because there are none to be had.** `src/db/index.ts`
types the local node-postgres handle as the production Neon HTTP one, and Neon
HTTP refuses `db.transaction`; `db.batch` is atomic there but does not exist on
node-postgres, so using it would break `bun run local`. The order is chosen
instead: a crash between the two writes leaves a posting with no shares, which
is an under-charge that `verify` reports and a person repairs from the amount
the posting kept. The other order leaves shares nobody can recognise as already
charged, which is the bug being fixed.

The migration backfills a posting for every fine already charged, at the amount
CHARGED rather than the amount owed. Those agree for a fine written correctly
and differ for one written by the bug, and recording what was actually taken is
what lets verify say so.

`ledger_entries` stays append-only and stays the truth. Corrections are
reversing rows, as invariant 3 already says.

**Balances stay a sum.** No cached balance column. The ledger is small (one row
per fine share, a handful a week per group) and a cached balance is the one
piece of derived money state worth not having.

Timing, in words a user can be told: *a missed activity becomes an entry the
following morning, once everyone's day has closed.*

Escalating fines are not in v3. `fineStep` and `fineCap` stay unread.

### verify: cover the money

`verifyUser` gains two kinds and one property check.

- **outcomes**: replay `activity_outcomes` and diff `passed`, `fine_amount`,
  `currency` and `rules_version`.
- **ledger**: for every posting, the shares must sum exactly to the fine
  (invariant 7), every share must go to a member who passed that period and
  shares that type, and no fine may exist for a group with money off on the day
  it closed. Also: no ledger row without a posting, and no posting without
  rows.
- **streak**: rebuild the counter from `events` and diff `current`, `best` and
  `grace_spent`. This is the check that would have caught the weekly bug, and
  it is what says so when a press bump and the event it came from have come
  apart, which they can, since the two cannot be one write.

`verify` keeps replaying from the beginning. That is the point of it, and it is
the reason the caches above are safe to trust.

Run it nightly, after scoring, and report drift where drift is visible. A
reconciliation nobody runs is a reconciliation that finds nothing.

## Decided

- **A read catches up.** If a day has ended and its close is not written, the
  read closes it, then reads. One day, never a replay, and never money. A
  failed cron stays invisible to users, which is the guarantee the lazy close
  was built for in the first place.
- **A streak moves `+1` or to `0`, never anything else.** Grace holds it.
- **Nothing is shown for a fine until it posts.** The ledger gains the entry
  the following morning, once everyone's day has closed. Until the split is
  known the debt does not exist, so there is no pending state anywhere.
- **`verify` runs nightly**, after scoring, and drift lands on the admin Ops
  drift block that already exists.
- **A score of 999.999 is shown as 1000, and that is fine.** The curve
  approaches 1000 and never touches it, which is what makes the top mean
  something, but the UI shows no decimals so the distinction is invisible
  where it would matter. Reports round the same way rather than exposing a
  precision the app never shows. Aman's call.

## Built

All six steps are in, on `main`. Each was one commit, and each ends somewhere
shippable.

1. **The read path stops writing fines.** `closeOutstanding` passes
   `fines: false`, so `scoreAll` is the only writer of a fine. That alone
   removes the double-charge, because the nightly job already scores everyone
   before it settles.
2. **`fine_postings`.** Claimed before the shares, per the note above.
3. **`verify` covers outcomes, the ledger and the streak**, and the cron runs
   it after scoring and records `ops.verify.ran`. Admin Overview reads that
   recorded run instead of recomputing seven days for every user on every page
   load; Ops still verifies live.
4. **Reputation carries the balance**, with `logic_version`, a replay fallback,
   and quantisation.
5. **`activity_streaks`**, `daysDone` on the module interface, the press bump,
   and the hold-on-grace rule.
6. **The per-day queries are gone**, in `recomputeGroups` and in the read path
   above it.

**What it cost to draw Home**, on the seeded local database:

| | before | after |
|---|---|---|
| Home | 6.8 s | 135 ms cold, 88 ms warm |
| A full replay of one user | 2.9 s | 346 ms |

### Proven, not assumed

- **The double-charge.** `bun run check:money` settles a fine with one peer
  scored and then with two, and asserts the ledger sums to the fine. On the
  commit before `fine_postings` it reports 750 against a 500 fine.
- **The ledger checks fire.** An extra share to a peer scored later, injected by
  hand, was reported twice over: shares summing to 5099 against a 5000 posting,
  and a payee who had not passed. Nothing reported that before.
- **The resume agrees with the replay.** Sixty days of `reputation_daily`
  deleted and rebuilt by the incremental close reproduce the full replay
  exactly, and `verify` reports zero drift. It did not, the first time, which is
  where the quantisation came from.
- **The press ticks on the day it completes.** Water pressed from zero: glasses
  one to seven move nothing, the eighth moves the streak from 4 to 5, and
  `verify` agrees afterwards.
- **Gym.** 22 where the old read path collapsed it, with three passed weeks
  reproducing as 3 rather than 1 in a domain test.
- Drift harness 67/67, 232 domain tests, `verify` clean on a fresh seed.

## After the simulation: the record, and the day you join

The 30-scenario regression run answered two questions the design had left
standing, and both changed the model.

**IMMACULATE could be held while missing a day in eight.** The equilibrium
analysis put 87.5% completion at 969, above the old 950 line, and 85.7% at 854.
The curve saturates near the top, so widening the miss cost only moves the
cliff. So the title stopped being a score: it is the top band plus 60
consecutive days with nothing missed, and UNBROKEN moved from 850 to 900
(decision 122). `isImmaculate(score, cleanDays)` is the whole rule, and every
surface that draws a rank icon passes the run beside the score.

The run is read, not stored. `reputation_daily` already holds one row a day per
scope with `completion` null for a day that had nothing due, so `cleanRunFor`
counts back to the last day with something missed in SQL, one query for every
scope a user has. A day with nothing scheduled sits inside a run rather than
breaking it.

**A group could fine somebody for a day that ended before they joined it.**
`recomputeGroups` now starts at `countsFrom(joinedAt)`, the day after, and that
one boundary gates both halves: no outcome for the join day, so no fine, no
reputation row, and nothing to pay a member in grace out of either (decision
123). Join and leave dates became the member's own day rather than UTC in the
same change, because a UTC date hands anybody east of Greenwich who joins after
midnight a grace period that has already run out (decision 124).

Two scenarios hold it: `group-join-grace` misses the join day and the day after
in the same group and asserts one fine, not two, while the same miss moves the
member's own record on both days; `group-grace-not-paid` has the member in grace
pass a day somebody else missed and asserts the fine goes whole to the member
being counted.

## Open questions

- **Timezone.** `recomputeUser` resolves the zone once, for today, and replays
  all history in it. Moving country re-judges every past period. The research
  answer is to stamp the local date on each check-in as it happens, which would
  mean a payload field rather than a table.
- **Retroactive check-ins.** None exist today. If they ever do, the streak
  counter has to be rebuilt rather than incremented, which is another reason
  `events` is the truth and the counter is not.
- **Grace is still not applied to outcomes.** `graceUsed` is written `false` on
  every row and admin renders the column. Either grace belongs in
  `activity_outcomes` or the column should go. It is not a money bug, since
  grace has never protected a fine (decision 5), but it is a column that lies.

## Sources

- [Building a Duolingo-Style Streak System](https://engagefabric.com/blog/building-duolingo-style-streak-system)
- [Implementing Closing the Books pattern](https://event-driven.io/en/closing_the_books_in_practice/)
- [Snapshots in Event Sourcing](https://kurrentdb.kurrent.io/blog/snapshots-in-event-sourcing/)
- [Guide to Projections and Read Models](https://event-driven.io/en/projections_and_read_models_in_event_driven_architecture/)
- [Payment Ledger Design for Billing Systems](https://dodopayments.com/blogs/payment-ledger-design)
- [Idempotency Keys in Payment APIs](https://dodopayments.com/blogs/idempotency-keys-payment-api)
