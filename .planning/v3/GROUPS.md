# GROUPS.md — Groups

Groups are an opt-in accountability layer over a personal habit tracker. They
never own a user's data. They observe what a user chooses to share.

## Rules

- **Always invite-only** (decision 19). Open signup is a later release and even
  then only means anyone can hold an account, never that groups are discoverable.
- **Reputation is always on.** Every member has a score and a rank in every group
  (`REPUTATION.md`).
- **Money is a per-group toggle**, set by the creator (decision 18). A group with
  money off has no ledger at all.
- Membership stays enforced in the query layer via one `assertMember()` helper,
  on every query (invariant 10).

## Two toggles, and only two

Sharing granularity is deliberately small (decision 16).

**Group side.** The owner declares which activity **types** the group accepts.
A group might accept Sleep and Gym and nothing else.

**Member side.** For each accepted type, the member sets:

- share this activity here: one toggle,
- and, when it is on and the type has evidence at all, a checkbox: **share
  evidence with this group** (decision 38). Evidence means the photo and any
  extra fields the check-in carried, not the photo alone.

Both toggles appear in three places, and mean the same thing in all three: when
joining, in the group's Settings tab, and in the user's own Settings under
"what you share", where every group is listed together.

If the group accepts a type the member does not track at all, joining offers to
set it up first. The activity becomes the user's own either way, group or no
group, and only then can it be shared.

There are no per-day, per-photo or per-field choices. If someone wants a
particular photo not to be seen, they delete the log. Anything finer becomes a
settings screen nobody understands.

Consequences:

- A member sees, when joining, exactly what the group accepts and picks what to
  share. That choice stands until they change it or leave.
- Sharing fewer types lowers the reputation ceiling in that group
  (`REPUTATION.md`), it does not block membership.
- Un-sharing freezes the score and drifts it down to the new ceiling, no cliff
  (decision 15).

## Money

- Off by default. The creator turns it on for the group.
- **A user whose groups all have money off never sees money at all.** No
  balances on Home, no mention of fines on any screen (decision 43). Curfew
  stops being a money app for them.
- Fines are **owner-set, per activity** (decision 18).
- A miss produces a fine. **Grace does not waive it** (decision 5), which
  reverses v1 and v2.
- Money is integer minor units plus a currency code (invariant 7). Split shares
  sum exactly to the fine.
- `ledger_entries` stays append-only. Corrections are compensating rows.
  Settlements are rows (invariant 3).
- Still IOU tracking only. No payment integration (PRD section 8).
- Fines only ever apply to activities the member actually shares with that group.

## The evidence view

The reason photos exist in a group. Keep it plain.

- Today and yesterday load immediately. Older days come on demand behind a
  "load older" control, so the tab never pulls the whole retention window.
- A dated log of the evidence members shared, newest first.
- Each entry: who, which activity, when, the photo.
- Scoped to the retention window, so it is a recent log and not an archive.
- No reactions, no comments, no feed mechanics. Curfew is a clerk, not a social
  app. The Snapchat part is the ephemerality and the ease of capture, not the
  tone.
- Photos are served by short-lived signed URLs, only to members the sharer chose.

## The day you join

A group starts counting a member the day AFTER they joined (decision 123).
Somebody who accepts an invite in the evening has already lived that day, and
its windows shut before the group existed to them.

- **No outcome, no fine, no reputation** in that group for the join day. The
  group's score series begins the next morning, opening on the joining score.
- **Their own streaks and their own global record count the day as normal.**
  Neither was ever the group's to judge.
- **Nothing is received either.** A member inside the grace has no outcome for
  the day, so they are not among the people another member's fine is split
  between. It is the same fact seen from the other side rather than a second
  rule.
- **The whole group sees it**, on the members list, as a `GRACE` tag with the
  hours left in place of a score. A member sitting at no score with no
  explanation reads as one being let off.
- **Once.** The grace is the join date, so rejoining sets a new one only
  because a rejoin is a new join.

The date itself is the member's own day, not UTC (decision 124).

## Leaving a group

On leave (decision 17):

- **Money due is retained.** Ledger rows are never deleted and outstanding
  balances remain owed and visible to the counterparties.
- Streaks, reputation and evidence stop being visible to that group immediately.
- The group's history keeps the fact that a member was there and what they owe,
  nothing about their habits.
- A member who rejoins starts fresh in that group, with a starting score set by
  the hidden global score (`REPUTATION.md`), never their old number.

The sole-owner guard from v2.5 still applies: an owner cannot leave while other
members remain unless another owner exists.

## Deferred: objections

Not built in v3 (decision 23). Recorded here so the model leaves room.

- Any member can **flag** a shared evidence item that looks false.
- A flag affects **reputation in that group only**, and never money or streaks.
- Flag-only. No resolution workflow, no voting, no verdict.
- Guardrails when built: a short window after the log, a cap per objector per
  month, and effects that expire. Framed as flagging for the group, not accusing
  a person.
