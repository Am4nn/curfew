# ACTIVITIES.md — The activity model

An activity is the unit of the whole app. A user owns their activities. Groups
only ever observe what a user chooses to share. See `SCOPE.md` for the
decision log this expands.

## The shape of an activity

Every activity a user enables is an instance of a **type** from the catalog, plus
that user's own configuration. Two users tracking Gym can be held to completely
different things.

Per-user configuration fields:

| Field | Meaning | Example |
|---|---|---|
| `period` | The unit a pass is judged over | `day` or `week` |
| `dayBoundary` | When a day starts for this activity | `midnight` (default) or `noon` (sleep) |
| `scheduledDays` | Which days count | every day, chosen weekdays, or "any N per week" |
| `frequency` | For "any N per week", the minimum | 3 |
| `windows` | Named check-in windows inside a day, with times | night 22:00-00:30, wake 06:30-07:45 |
| `passTest` | What makes the period a pass | count and/or a numeric threshold |
| `grace` | Missed periods forgiven per calendar month | 2 |
| ~~`evidence`~~ | **Not user-configurable.** The type fixes it | see below |

A type supplies the defaults and the pass test's shape. The user overrides the
numbers.

**Evidence is the exception.** Whether a photo is off, optional or required, and
whether it may come from the gallery, belongs to the **type**, not the user
(decision 6). Food always requires one, Gym is always optional, Steps allows the
gallery. The configure screen states the rule and does not offer it as a
control. Two people's Food streak therefore mean the same thing in the same
group.

Type names are **one word** with a one-line description used wherever an
activity is offered (decision 36): Sleep, Gym, Food, Supplements, Office, Study,
Steps.

## Periods and days

- A **period** is what a pass is judged over: a day, or a week.
- Every activity resolves to days for streak purposes. Streaks are always counted
  in days (decision 2).
- `dayBoundary` exists because sleep needs noon-to-noon while the rest want
  midnight. Default midnight; sleep sets noon. `periodStart()` stays the single
  place this is computed (existing convention), but it now takes the activity's
  boundary as an input instead of hardcoding noon.
- A week runs Monday to Sunday in the user's timezone. It is judged at week end.

## Streaks

**A streak is a count of days you did the activity.** One rule, three cases.

**Every-day activities.** Each passed day adds 1. A missed day resets to 0,
unless grace covers it.

**Chosen-weekday activities** (Office on Mon to Fri). Only scheduled days can add
or break. Saturday and Sunday are skipped, not broken.

**Frequency activities** ("any 3 per week"). Days you did it add 1 each, so doing
six sessions in a week adds 6 even though the minimum is 3. The week is judged at
week end:

- Week met its minimum: the days already added stand, the run continues.
- Week missed its minimum: the run resets to 0, unless grace covers the week.

Worked example, Gym at 3 per week, starting streak 12:

| Week | Sessions | Streak after |
|---|---|---|
| 1 | 6 (Mon Tue Wed Fri Sat Sun) | 18 |
| 2 | 3 | 21 |
| 3 | 2 | 0, or 21 with a grace spent |

The number always answers "how many days have I done this", which is the point.

**Mid-week it counts up live** (decision 77). Monday's session shows 22 straight
away, Tuesday's 23. If the week then misses its minimum those days are taken
back: 0, or the week's opening 21 when grace covers it. The streak can therefore
go down, which is the honest reading of a number that means days completed. The
alternative, holding at last week's value until Sunday, leaves it stale for six
days out of seven and shows no progress for a week going well.

## Grace

- Grace is **per activity, per calendar month**, a small integer the user sets.
- A grace is spent automatically when a period would break the streak.
- Grace protects the **streak only** (decision 5). The fine still applies and
  reputation still dips.
- This reverses v1 and v2, where grace waived the fine. Call it out in the
  release notes.
- The UI always shows the remaining count: "2 graces left this month".
- Unused grace does not carry over.

## Pass tests

A pass test is owned by the type's module. The engine consumes
`{ passed, detail }` and never inspects `detail` (invariant 6). Two composable
shapes cover the launch catalog:

- **Count**: at least N check-ins in the period, optionally one per named window.
- **Threshold**: a recorded number is at or below, or at or above, a target.

They combine with AND. Food is the case that needs both: at least 3 check-ins in
the day **and** total calories under 2000, when the user configures it that way.

## Launch catalog

Icons are specified during the mocks. Every row is a starting default the user
can change.

| Type | Default period | Default schedule | Default pass test | Evidence default |
|---|---|---|---|---|
| Sleep | day, noon boundary | every day | one check-in per window (night, wake, confirm) | **required on the confirm window**, live |
| Gym | week | any 3 per week | 1 check-in on a session day | **required**, live |
| Food | day | every day | 3 check-ins, calories under target when set | required, live, **and the calorie figure with it** |
| Supplements | day | every day | 1 check-in a day, **no window** | required, live |
| Office | day | Mon to Fri, 10 AM to 2 PM | 1 check-in on a scheduled day | optional, live |
| Study | day | every day | 1 check-in, or minutes at or above target | **required**, live |
| Steps | day | every day | step count at or above target | optional, gallery allowed |
| Water | day | every day | glasses at or above target | none |
| Reading | day | every day | minutes or pages at or above target | optional, live |
| Screen | day | every day | screen time **at or below** the limit | optional, gallery allowed |
| Nightfast | day | chosen days | declared clean in the morning window | none |
| Sugar-free | day | every day | declared clean in the evening window | none |

Steps is the only type where gallery upload is a sensible default, because the
number lives in another app. Everything else defaults to live capture.

## Extensibility

The repo is open source and will take outside PRs, so adding a type must be a
small, well-fenced job (decision 24).

- One module per type, implementing a single interface: metadata (key, name,
  icon, default config), a config schema, a pass test, and a renderer hint for
  the check-in affordance.
- The engine imports the registry, never a specific module. No `switch` on type
  key outside the registry.
- Nothing outside a module knows what its `detail` payload means.
- A new type must not require a migration for the general case. Per-user config
  is a JSON column validated by the module's schema.
- Event types stay namespaced and stable: `checkin.gym.session`, never
  `gym_checkin`.
- Reserve room for evidence kinds beyond images and for derived data such as AI
  nutrition values, both without a schema change.

Contributor docs (a CONTRIBUTING guide and an "adding an activity type" walk
through) are written alongside the first non-sleep module, not after.

## Engine work this forces

1. `periodStart()` takes an activity's boundary and period unit instead of
   assuming noon-to-noon daily.
2. Scoring loops over periods that are not all the same length.
3. Config resolution stays effective-dated and insert-only (invariant 4), but a
   change lands at the **next period start for that activity**, so a Thursday
   change to a weekly activity applies from next Monday (decision, and invariant
   5's as-of rule).
4. Grace accounting moves from group activity rules to the user's activity.
5. `activity_scores` gains the period unit so a weekly row is distinguishable
   from a daily one.

## Screens

Both entry points lead to the same configure screen (decided in the mock
review):

- **Your activities** lists what the user tracks. Tapping a row opens configure
  with the activity's streak at the top and a "stop tracking" control at the
  bottom.
- **Add activity** lists the catalog. Tapping a type opens the same screen with
  the type's defaults prefilled and a single "start tracking" button instead.
- Streak is shown with the app's flame icon; the large figure on configure uses
  the flame gradient.

## Abstinence types

Nightfast and Sugar-free pass by *not* doing something, which inverts the whole
engine: every other type treats silence as failure, and abstinence would treat
it as success (decision 50).

Left as pure honesty, the app would reward deleting it and coming back to a
90-day streak. That is precisely what invariant 2 exists to prevent. So:

- **You still check in once a day.** One screen, two answers: "It held" or "I
  slipped". Silence is a miss like anywhere else.
- The pass test is "declared clean", not "did the thing".
- **Evidence is always none** (decision 51). A photo cannot prove absence, so
  the UI says so plainly rather than pretending otherwise.
- Money on an abstinence activity is a bad fit: a fine gives you a reason to
  hide a slip, and unlike a missed gym session there is nothing to contradict
  you. Reputation-only groups suit these types. Not forbidden, worth saying.

Mechanically an abstinence type is the simplest module in the catalog: a daily
mark with inverted copy and no evidence.

## Thresholds run both ways

A threshold pass test carries a direction (decision 52). Steps passes at or
above its target; Screen passes at or below its limit. Same field, opposite
comparison. Food uses both at once: a count at or above three, and calories at
or below the limit.

## Switching things off

Anything can be turned off: a user stops tracking an activity, an admin retires
a type, disables money, or disables photo evidence. **Every calculation resolves
the state as it stood on the period being scored** (decision 59, extending
invariant 5). Nothing off rewrites history, and nothing off creates a
retroactive miss.

| What is turned off | Streaks | Reputation | Money | Evidence |
|---|---|---|---|---|
| A user stops tracking an activity | Stops producing periods that day. The streak freezes at its last value and the history is kept. Restarting resumes from zero | Stops counting it from that day. The breadth ceiling drops and the score drifts down to it | No further fines for it | Existing photos live out their retention |
| A user stops sharing it with a group | Unaffected, it is still theirs | Frozen, then drifts to the new ceiling | No further fines in that group | The group stops seeing new photos, and loses the old ones |
| Admin retires a type | Unaffected. Everyone tracking it keeps it and keeps being scored | Unaffected | Unaffected | Unaffected |
| Admin turns money off | Unaffected | Unaffected | No new fines from that moment. Every existing entry stays and reappears when it is switched back on | Unaffected |
| Admin turns photo evidence off | Unaffected | Unaffected | Unaffected | A type that required a photo stops requiring one. **A check-in is never blocked by an admin switch** |
| Admin shortens retention | Unaffected | Unaffected | Unaffected | Anything already older is deleted on the next sweep |

The rule that matters most is the last one in the evidence column: an admin
switch may remove a requirement, never a user's ability to check in. Otherwise
one toggle silently breaks everyone's streak.
