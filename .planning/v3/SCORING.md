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

At close (nightly, or lazily on the first read of a new day):

- Daily type: a scheduled day with nothing done spends grace, or resets
  `current` to 0.
- Weekly type: if `week_sessions` reaches `perWeek` the week stands. If not,
  grace holds `current` at `week_opening`, or it resets to 0. Then
  `week_opening` becomes `current` and `week_sessions` becomes 0.

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

## Build order

1. **Stop the read path writing fines.** One line. Removes the double-charge.
2. **`fine_postings`** and the transactional split.
3. **`verify` covers outcomes and the ledger.** Before the caches, so the
   caches land into something that can check them.
4. **Reputation carries the balance**, with `logic_version` and the replay
   fallback.
5. **`activity_streaks`** and the day log, which fixes weekly streaks as a
   consequence.
6. **Delete the per-day queries in `recomputeGroups`.** Load sharing, money and
   fine rules once per user and resolve them in memory.

1 to 3 are correctness. 4 to 6 are the speed, and 5 is also a bug fix.

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
