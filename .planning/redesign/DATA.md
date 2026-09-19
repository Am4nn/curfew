# What is on each mock, and what feeds it

The canvas is at https://claude.ai/artifact/U6x8pi4khQX5qxBSGEiHyi

A mock that shows a number nothing can produce is a promise the build cannot
keep, and the promise is only found at the end, when somebody tries to wire the
screen up. So every block on every artboard is listed here against the query
that would fill it, in one of three states:

- **has** — the field exists and the route already reads it.
- **derives** — no new concept, but a query has to be written or widened. The
  note says which.
- **new** — the data does not exist anywhere. These are the decisions, and there
  are only five of them.

Every name, photograph and amount on the canvas is invented. The cast is Mira,
Anya, Kabir and Noor, and none of them is anybody.

## One person, one day, across every board

The boards are not independent sketches. They are one account on Thursday 17
September at about 7:35 PM, and every number agrees with every other number. If
a board says seven activities, every board says seven.

| Activity | Rule | Streak | Best | Today |
|---|---|---|---|---|
| Water | 8 glasses a day | 31 | 31 | 5 of 8, open |
| Supplements | 2 doses a day | 27 | 27 | taken 8:15 AM |
| Sleep | In bed by 10:30 PM, up by 6:30 AM | 19 | 24 | confirmed 8:02 AM |
| Nightfast | Nothing after 8:00 PM | 14 | 16 | held, answered 9:10 AM |
| Gym | 3 days a week | 12 | 12 | 2 of 3, closes 8:00 PM |
| Food | 3 meals, under 2,000 calories | 6 | 28 | 3 meals, 1,640 calories |
| Reading | 30 minutes a day | 0 | 15 | ended yesterday, restore open |

Four of seven are in, which is what Home's counter, the check-in screen's
counter and the restore sheet's dimmed background all read. Grace left is 2 of
14, on Home, on Activities and on Your record. The global score is 714 and the
Morning Crew score is 692, on Groups, Activities and Standing.

## Home — `Main.dc.html`

| Block | Source | State |
|---|---|---|
| 4 of 7, and the segments | `Today.done` / `Today.of` | has |
| Grace pill, "2" | `Today.graceLeft` | has |
| Promoted activity, its streak, its shutter | `TodayRow` where `open` and the deadline is nearest, plus `standingFor().streak` | derives: Home has every row, nothing ranks them by urgency |
| "Closes 8:00 PM" | `deadlineFor()` in `reminders.ts` | has |
| "Mira has already been" | a peer check-in on a type you share, which the `peer` notification kind already detects | derives: the kind reads it on a tick, no screen does |
| "1 more day this week" | gym's `remind()` | has |
| Each row: icon, name, streak, status | `TodayRow.icon` / `.name` / `.streak` / `.status` | has |
| The + on an open row | `TodayRow.open` | has |
| Restore on Reading | `TodayRow.restore` | has |
| The tick on a done row | `TodayRow.countedToday` | has |
| "Happening now", 9 today | `groupEvidence()` per group | derives: one query, across every group you are in, newest first |
| Each feed photograph | `groupEvidence().objectKey`, signed | has |
| The group chip on a feed item | `groupEvidence` is called per group, so the caller knows | has |
| The flame badge on a photograph | that member's streak for that type | derives: `memberStandings().streaks` carries it as a string, so it would need parsing or a field |

## Activities — `Activities.dc.html`

| Block | Source | State |
|---|---|---|
| 714 and DISCIPLINE | `globalScore()` and `rankFor()` | has, and `/activities` already draws it |
| "Seven tracked" | `listUserActivities()` | has |
| Each rule line | the module's own summary of its config | has |
| Each streak | `standingFor()` | has |
| Going away | `/settings/pause` | has, but the route is buried in settings. Moving it here is the proposal |
| Grace, 2 of 14 | `graceState()` | has, same: it lives at `/grace` and nothing points at it |

## Your record — `Stats.dc.html`

Every block is a field of `Overview` in `src/server/stats.ts`. Nothing on this
screen needs a query that does not already run.

| Block | Source | State |
|---|---|---|
| 17 of 30 perfect days | `perfectDays`, `daysInMonth` | has |
| "2 days away are not counted" | `awayThisMonth` | has |
| 84% periods passed | `passRate` | has |
| 31 longest running streak | `longestStreak` | has |
| 2 grace left | `graceLeft` | has |
| The eight-by-seven grid | `heatmap`, 0..1 of what was scheduled, -1 future, AWAY for a declared trip | has |
| Each activity's bar and percent | `byActivity.percent` | has |
| Each activity's streak | `byActivity.streak` | has |

**The photo grid that used to be here was wrong.** `ownPhotos()` is real, but
the route calls it on the per-activity view with a limit of six, under a link to
`/settings/photos`. A month of photographs on the overview was two screens'
data drawn as one.

## Groups — `Groups.dc.html`

| Block | Source | State |
|---|---|---|
| The invite card | `listInvites()` | has |
| Group name, member count | `groupHeader()` | has |
| Score and rank per group | `standingIn().score` | has |
| Faces | `listGroupMembers()` | derives: the list page does not read members today |
| The live dot, "Mira and Anya logged today" | `groupEvidence()` since midnight | derives |
| Money per row | `getUserDebts()` carries `groupId` and `groupName`, so it groups by row | derives |
| "Across everything: 714" | `globalScore()` | has |

## One group — `Group.dc.html`

| Block | Source | State |
|---|---|---|
| "3 members · Sleep, Food, Supplements" | `groupHeader()` and the union of shared types | has |
| ₹140 due to you here | `groupBalances().netOwed` | has |
| "₹450 of fines this week" | `getGroupLedgerRows()` filtered to this week's `periodStart` | derives |
| 45 of 63 | `weekStats.done` / `.of` | has |
| Member name, done of 21 | `weekStats.byMember` | has |
| The seven dots per member | **new**: `byMember` has no per-day breakdown. `byDay` exists but is the whole group. One field, `byMember[].byDay` |
| Today, 5 posted | `groupEvidence()` since midnight | has |
| Each photograph and its badge | `groupEvidence()` | has |
| React | **new**: there are no reactions. Objections are out of scope until after v3 and are flag-only when they land, so a reaction is a separate decision, not a variant of one |

**The pot was wrong and is gone.** There is no pot and no Sunday. A fine is
written when a period closes and split there and then among the members who
passed it, so what a group has is a running balance and a ledger. The card now
says the balance and links to it.

## Standing — `Standing.dc.html`

| Block | Source | State |
|---|---|---|
| 692, DISCIPLINE, the bar | `standingIn().score`, `rankFor()` | has |
| +4 today | `movements[0].delta` | has |
| Ceiling 820, the dashed mark | `standingIn().ceiling` | has |
| "You share 3 of the 7 activities you track" | `standingIn().breadth` | has |
| 208 to UNBROKEN | `RANKS` in `src/domain/ranks.ts` | has |
| You owe ₹200 / you are owed ₹340 | `getUserDebts()` summed both ways | has |
| Every entry, 31 rows | `getGroupLedgerRows()` | has |
| Recent movement | `movements`, each a `{ day, delta, reason }` | has |

## How standing works — `Ranks.dc.html`

Five bands with their real `from` values and their real `meaning` strings out of
`src/domain/ranks.ts`, and IMMACULATE, which is UNBROKEN plus
`IMMACULATE_CLEAN_DAYS` with nothing missed. All **has**. IMMACULATE carries the
only glow in the app, which is the whole reason it means anything.

## Configure · Sleep — `Configure.dc.html`

| Block | Source | State |
|---|---|---|
| The rule in a sentence | the module's summary | has |
| "A night belongs to the day it ends" | the module's boundary | has |
| Night and Wake windows | `UserActivity.config` | has |
| Confirm, marked ANCHORED | sleep's confirm window opens 30 minutes after the Wake press and has no clock times | has |
| Photo required on confirm | the module's evidence requirement | has |
| Which days | `UserActivity.schedule` | has |
| "Anything you change here starts tomorrow" | invariant 4: config is insert-only and future-dated | has |
| Stop tracking | `stopTracking()` | has |

## Check in — `Capture.dc.html`

| Block | Source | State |
|---|---|---|
| Food, meal 3 of 3 | `CheckinStepView` | has |
| "Live camera only. No gallery." | the in-app camera, a gallery photo is not accepted | has |
| Calories, and 1,640 of 2,000 once sent | the food module's own field and `hint()` | has |
| 4 of 7, the segments rolling | `Today.done` after the press | has |
| Food streak 6, best 28 | `standingFor()` | has |

## Check in, no camera — `Declare.dc.html`

| Block | Source | State |
|---|---|---|
| "Did the fast hold?" | the abstinence module's kind | has |
| 14, two short of your best | `standingFor().streak` / `.best` | has |
| It held / I slipped | the two answers an abstinence check-in takes | has |
| "You can change this until 10:00 AM" | the window is open, and the last answer counts | has |

## Restore — `Restore.dc.html`

| Block | Source | State |
|---|---|---|
| Reading, 15 | `OpenOffer.restoresTo` | has |
| "Ended yesterday" | `OpenOffer.brokeOn` | has |
| Costs 2 grace, 2 left this month | `OpenOffer.cost`, `graceState().left` | has |
| OPEN UNTIL YOU NEXT CHECK IN | `OpenOffer.closes` | has |
| "Only the streak comes back" | `spendGrace()` writes a `grace.spent` event and nothing else | has |

## The day is done — `Stamp.dc.html`

| Block | Source | State |
|---|---|---|
| The stamp on the date | `Today.done === Today.of` | has |
| Seven icons | `Today.rows` | has |
| Nothing stored | the stamp marks a moment and writes nothing | has |

## The five decisions

Everything above is either built or a query away, except these:

1. **Reactions on a shared photograph.** Nothing like it exists. Objections are
   deferred to after v3 and flag-only when they land, so this is its own
   decision about what a group may say to a member, not a variant of one
   already taken.
2. **`byMember[].byDay` on `weekStats`.** One field. Without it three members
   cannot be compared down a column, which is the whole point of the group
   screen.
3. **A cross-group feed.** Home's "Happening now" reads every group you are in.
   `groupEvidence` is per group and enforces membership per group, so this is a
   loop, not a new permission. It has to stay a loop for that reason.
4. **Ranking today's open activities by urgency**, so one can be promoted. Home
   has every row and nothing orders them. `deadlineFor()` already computes the
   answer for notifications.
5. **Moving Going away and Grace out of settings.** Both routes exist and
   nothing points at them, which is the complaint the testers made in the words
   they used: the important things are in settings.
