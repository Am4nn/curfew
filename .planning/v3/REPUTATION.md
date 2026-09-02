# REPUTATION.md — The reputation score

Reputation is a number between **0 and 1000 inclusive**, per user, per group. It
never leaves that range under any circumstance. Ranks are bands on this number
and live in `RANKS.md`.

## What it measures

How well you are keeping the commitments you share with **that group**. Two
things move it: **consistency** (do you pass the periods) and **breadth** (how
many of the group's accepted activity types you share). A member sharing five
activities and holding them is worth more than one sharing a single easy
activity perfectly.

Reputation is always on in a group. Money is a separate toggle
(`GROUPS.md`).

## Shape of the model

- A **running score**, not a recomputed window. Each day applies a delta on top
  of yesterday's value. History is implicit in the current number
  (decision: plus and minus on top of current, never a full-history scan).
- **Gains shrink as the score climbs**, so 1000 is approached and effectively
  never reached.
- **Losses soften at the top too**, so a single miss dents rather than collapses
  a long record. It still costs real ground.
- **Breadth sets a ceiling.** Sharing one activity out of five caps you well
  below the top by construction.
- **Inactivity decays.** Without this, someone reaches a high score, stops
  logging, and sits there forever because there are no misses to punish.

## The formula

Let, for user `u` in group `g`, evaluated once per day:

```
S      current score, 0..1000, starts at the joining score (see below)
b      breadth = shared_types / accepted_types, 0..1
C      ceiling = 250 + 750 * b                (b=0 -> 250, b=1 -> 1000)
d      day completion = passed_periods / scheduled_periods concluding today,
       counting only activities shared with this group
h      headroom = max(0, (C - S)) / 1000
```

Daily delta:

```
nothing scheduled today            ->  neutral, no change
d == 1 (a clean day)               ->  S += G * h
d <  1                             ->  S -= L * (1 - d) * (h + 0.15)
S > C (ceiling dropped)            ->  S -= DRIFT, until S == C
no scheduled period for 7 days     ->  S -= IDLE per day
```

Constants, tunable: `G = 12`, `L = 20`, `DRIFT = 2`, `IDLE = 3`.

Clamp to `[0, 1000]` after every step.

Notes:

- **Grace does not protect reputation** (decision 5). A graced miss saves the
  streak but the day still counts as incomplete here.
- Only shared activities count, and only from the day you joined and opted in.
  No retroactive credit or blame.
- **A newly added or newly shared activity cannot move reputation for 14 days**
  (decision 54). Without this, adding a hard habit is a risk to your standing,
  and the score would quietly punish anyone with ambition. Two weeks is long
  enough to learn whether you can hold it.
- Weekly activities contribute one scheduled period on the day the week is
  judged, not seven.

## Target properties

These are the spec. The constants above are one way to hit them; tune the
constants, not the properties.

| Property | Target |
|---|---|
| Starting score | 200, unless the hidden global score says otherwise |
| First rank-up (200 to 350) on a perfect record | around 5 weeks |
| Reaching 600 | around 2 months |
| Reaching 850 | around 4 to 5 months |
| Reaching 950 | around 7 to 8 months of near-perfect breadth-complete adherence |
| Reaching 1000 | asymptotic, treated as unreachable, and said so plainly in the UI |
| Cost of one missed day at the top | roughly a week of clean days to recover |
| Cost of one missed day near the start | small, a couple of days to recover |
| Score after abandoning a group for a month | drifts down, does not stay high |
| Sharing 1 of 5 accepted types | caps around 400 |

## Un-sharing and ceiling drops

When a member stops sharing a type, or an owner removes an accepted type, the
ceiling `C` changes (decision 15):

- The score **freezes** at its current value, keeping past history.
- If `S > C`, it **drifts** down by `DRIFT` per day until it meets the new
  ceiling. No cliff.
- This deliberately closes the exploit where someone un-shares an activity right
  after a bad week to scrub the damage: the damage is already in `S`, and
  un-sharing only lowers what they can climb back to.
- An owner removing a type therefore does not instantly punish anyone.

## The global score

A single per-user score across the whole app, shown to its owner at the top of
Activities and to nobody else (decision 10).

- Computed with the same formula over the activities the user **shares with at
  least one group**, with `b = 1` (decision 53). Activities tracked privately
  never touch it, so experimenting with something hard costs nothing.
- Its **only** effect: it sets the starting score in a group you join, clamped to
  `[100, 300]`:

  ```
  joining_score = clamp(100, 300, 100 + (global / 1000) * 200)
  ```

- It never touches the live score afterwards, so one group's behaviour cannot
  leak into another.
- It exists to stop someone escaping a bad record by leaving and rejoining.
- It is **never** visible to other users, in a group or anywhere else. There is
  no app-wide ladder.
- **It is disclosed in the consent form.** A hidden score that affects people is
  acceptable when documented and indefensible when discovered.

## Rebuildability

Invariant 1 says `events` is the only source of truth. Reputation is derived and
must be replayable:

- Store the score like `activity_scores`: a derived table, one row per
  (user, group, date), rebuildable by replaying daily deltas from the join date.
- Replay reads only `activity_scores` and the sharing configuration as they stood
  on each day (invariant 5).
- Monthly checkpoints are allowed as a speed optimisation, never as truth.
- `bun run verify` must be able to recompute a reputation range and diff it, the
  same way it does scores.

## Presentation

- In a list, show the **rank icon in the rank colour, then the number in the same
  colour**. The rank word is dropped: the icon and colour carry it (decision 40).
- On a standing screen, where there is room, the word and the distance to the
  next rank both appear.
- The streak owns the only gradient in the app. Reputation never gets one.
- Show members' numbers within a group, ordered. Ranks are comparable and
  competitive by decision.
- Never show the hidden global score.
- Clerk voice. State the number and what moved it. No congratulation.

## Deferred

Objections, when they land, subtract from reputation in that one group only.
They are capped per objector per month and expire, so a flag cannot be used as a
weapon. Nothing about them is built in v3, but leave room in the delta model for
a third source of change beyond pass, miss and drift.
