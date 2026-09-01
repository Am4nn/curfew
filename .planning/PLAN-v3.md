# PLAN-v3.md — Curfew as a habit tracker

Scope decisions taken by Aman on 2026-09-01. Companion to `PRD.md` and the v1
invariants in `../CLAUDE.md` (none relaxed here). RLS and DB-backed roles moved
to `BACKLOG.md`; v3 is now the reshape below.

## The reframe

Curfew is a **personal habit tracker**. A user tracks their own habits and keeps
a streak per habit. **Groups are an opt-in accountability layer**, not the point:
a group tracks a chosen set of activity types, and members opt in to be held to
them together.

- **Solo works with zero groups.** A new user is enrolled in **no** activities.
  They opt into activities for themselves, keep streaks, and get value before any
  group exists.
- **Groups are opt-in on both sides.** A user enables an activity for themselves;
  a group declares which activity types it tracks; the overlap is what the group
  holds you to.
- **Reputation first, money optional.** Groups are reputation-based by default.
  A group may **opt in to money** (fines) on chosen activities. Money is part of
  v3, not deferred, but it is never the default and never required.
- **Evidence is per activity, often none.** The app is for being true to
  yourself, so most activities are trust-based. Evidence scales by activity:
  none, a number, a photo, or a timed window.

## Activities (opt-in catalog)

Each activity is a module: its own **period**, **evidence rule**, and
**pass test**. Nothing outside the module knows what it means (invariant 6); the
engine consumes `{ passed, detail }`. Launch set:

| Activity | Period | Evidence | Pass test (first cut) |
|---|---|---|---|
| Timely Sleep (exists) | daily, noon-to-noon | timed windows | three window check-ins |
| Gym | weekly | none (trust) | N sessions logged in the week |
| Steps | daily | number (self-reported) | steps ≥ personal target |
| Go to Office | weekdays only | none (trust) | marked in on a work day |
| Study | daily | none, or minutes | logged / minutes ≥ target |
| Food + calories | daily | photo + calorie figure | **logged**, not the number (see open decision) |

More types are meant to be cheap to add later; the table is a starting set, not a
closed list.

## What v3 must build

1. **Engine: non-daily periods.** v1 assumes noon-to-noon daily everywhere
   (`periodStart()`, scoring, config/rules resolution, check-in state). Gym
   (weekly) and Office (weekdays) force this open. Do this first; it is the real
   work, and the first non-daily module will reveal what the `ActivityType`
   interface got wrong.
2. **Activity modules** in build order: Gym → Steps → Office → Study → Food.
   Gym first (weekly, trust-based, cheapest proof of a non-daily period). Food
   last (needs blob storage for the image, and an open scoring decision).
3. **Per-user opt-in.** A user enables/disables activities for themselves; a new
   user starts with none. Streak is per activity.
4. **Group activity types.** A group declares which activity types it tracks
   (replacing the v1 "one sleep activity per group"), and members opt in.
5. **Money opt-in.** A group (or a per-activity setting within it) can turn on
   fines; off by default. Reputation-only groups carry no ledger.
6. **Blob storage** (Food only): image upload. Vercel Blob is the clean fit.

## Open decisions

- **Food scoring rule.** Recommendation stands: the photo is evidence that a meal
  was **logged**; scoring is logging-consistency (logged yes/no), and the calorie
  figure is recorded and shown to the user only, never scored or ranked. Settle
  when Food is picked up.
- **Cross-activity streak.** Per-activity streaks are the source of truth. A
  single "overall" streak is murky (does missing the gym break your sleep
  streak?) and stays a later, optional view, not a v3 commitment.
- **Money-with-no-evidence tension.** A fine gives a reason to fib when there is
  no evidence. Keep money opt-in and, where a group turns it on for a trust-based
  activity, treat the stakes as social. Not resolved by design; resolved by
  keeping money deliberate and rare.

## Not in v3

- RLS, DB-backed roles/capabilities (`BACKLOG.md`).
- Native health integrations (Apple Health / Google Fit) — Steps stays manual.
- A cross-activity aggregate streak as the primary metric.
