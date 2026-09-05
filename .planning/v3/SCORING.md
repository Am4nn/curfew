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
activity_streaks
  user_id, type_key            primary key
  current            int       the run that is still alive
  best               int       never taken back
  last_day           date      the last activity-day counted
  week_opening       int       what current was when this week opened
  week_sessions      int       days done in the week in flight
  grace_spent        jsonb     { "2026-09": 1 }
  closed_through     date      every day up to here is accounted for
```

A press increments `current` and, for a weekly type, `week_sessions`. Nothing
is read except this row. Decision 77 stands: days add as they happen, so a
six-session week adds six.

Guarded by a unique constraint on the activity-day, so a double press or a
retry cannot add twice. The activity-day is the row in `activity_scores` for
daily types and, for weekly types, a new `(user, type, day)` record of days
done. That record is the missing piece today: the streak needs days, and only
periods are stored.

**A streak only ever does `+1`, or goes to `0`. Grace means it does neither: it
holds where it is.** There is no third movement, and in particular nothing
rolls it back to an earlier value. A number the user watched climb must not
fall while the app tells them grace protected them.

At close (nightly, or lazily on the first read of a new day):

- Daily type: a scheduled day with nothing done spends grace and holds, or
  resets `current` to 0.
- Weekly type: if `week_sessions` reaches `perWeek` the week stands. If not,
  grace holds `current` where it is, keeping the days that week added, or it
  resets to 0. Then `week_opening` becomes `current` and `week_sessions`
  becomes 0.

This changes the built `streakOver`, which rolls a graced weekly failure back
to `week_opening`. `week_opening` survives as the record of where the week
started, not as a value anything returns to.

A graced short week therefore leaves the user ahead by the days they did do.
Grace is capped per month, so it cannot be farmed.

`closed_through` is what makes the close idempotent and lets a missed night
catch up without double counting.

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
fine_postings
  group_id, type_key, period_start, from_user_id   primary key
  amount, currency, posted_at
```

The rows in `ledger_entries` and the posting row are written in one
transaction. If the posting row conflicts, the fine is already charged and the
whole split is skipped, including any share that does not yet exist. That is
the "unique constraint on the posting" rule, and it is what the current
per-payee index fails to give.

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
- **streak**: rebuild the counter from the activity-day log and diff `current`,
  `best` and `grace_spent`. This is the check that would have caught the weekly
  bug.

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

## Build order

Six steps. One to three are correctness, four to six are the speed, and five is
also a bug fix. Each ends somewhere shippable.

**1. The read path stops writing fines.**
`scoring.ts`: `closeOutstanding` calls `scoreUser(userId, { fines: false })`.
Money is then written by `scoreAll` and by nothing else. A test asserts that a
`closeOutstanding` on a user with a failed period writes no `ledger_entries`.
This alone removes the double-charge.

**2. `fine_postings`, and the split becomes one posting.**
Migration adds the table, primary key `(group_id, type_key, period_start,
from_user_id)`. `writeFines` wraps the posting row and its `ledger_entries`
rows in one transaction; a conflict on the posting skips the whole split rather
than inserting the shares that do not yet exist. `ledger_one_fine_idx` stays as
a second line of defence. A test replays a split with one peer, then with two,
and asserts the total charged is the fine.

**3. `verify` covers outcomes and the ledger.**
`verify.ts` gains `kind: "outcome"` and `kind: "ledger"`. Outcomes diff
`passed`, `fine_amount`, `currency`, `rules_version`. The ledger checks are
properties rather than a diff: shares sum exactly to the posting, every payee
passed that period and shares that type, no fine in a group with money off on
the day it closed, no ledger row without a posting, no posting without rows.
The cron calls `verifyAll` after `scoreAll` and stores the result where the
admin Ops drift block already reads from.

**4. Reputation carries the balance.**
Migration adds `logic_version` to `reputation_daily`. A new `closeDay(userId,
day)` reads the previous day's row per scope, applies `applyDay`, and inserts.
It falls back to `recomputeUser` when the previous row is missing or its
`logic_version` does not match. `recomputeUser` and `replay` are untouched and
stay what `verify` uses. `verify` proves the two agree.

**5. `activity_streaks` and the day log.**
Migration adds `activity_streaks` and, for weekly types, the `(user, type,
day)` record of days done. The check-in path increments the counter in the same
transaction as the event, guarded by the day's unique constraint. `standingFor`
becomes a single row read. `streakOver` stays as the rebuild used by `verify`,
amended to the hold-on-grace rule above. Weekly streaks are correct as a
consequence, and `verify` gains the streak diff that would have caught it.

**6. `recomputeGroups` stops querying per day.**
`acceptedTypes`, `sharesFor`, `fineRuleFor` and the money toggle load once per
user and resolve in memory. Same answers, one round trip each instead of four
per day per group.

Verification: `bun run test` and `bun run typecheck` after every step,
`bun run verify` at zero drift after 2, 4 and 5, and the drift harness
recaptured after 5, which is the only step that changes a screen.

## Open questions

- **Timezone.** `recomputeUser` resolves the zone once, for today, and replays
  all history in it. Moving country re-judges every past period. The research
  answer is to store the local date on each activity-day at the time it
  happens, which the day log above would make possible.
- **Retroactive check-ins.** None exist today. If they ever do, the streak
  counter has to be rebuilt rather than incremented, which is another reason
  the day log is the truth and the counter is not.

## Sources

- [Building a Duolingo-Style Streak System](https://engagefabric.com/blog/building-duolingo-style-streak-system)
- [Implementing Closing the Books pattern](https://event-driven.io/en/closing_the_books_in_practice/)
- [Snapshots in Event Sourcing](https://kurrentdb.kurrent.io/blog/snapshots-in-event-sourcing/)
- [Guide to Projections and Read Models](https://event-driven.io/en/projections_and_read_models_in_event_driven_architecture/)
- [Payment Ledger Design for Billing Systems](https://dodopayments.com/blogs/payment-ledger-design)
- [Idempotency Keys in Payment APIs](https://dodopayments.com/blogs/idempotency-keys-payment-api)
