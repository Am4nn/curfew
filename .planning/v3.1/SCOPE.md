# SCOPE.md — v3.1

Seven raw ideas, given 2026-09-08. Nothing here is decided. Each one is written
down as it was asked, then what is actually true today, measured rather than
assumed, then what the work really is and what still needs answering.

Three of the seven turned out to be defects rather than ideas. Two are larger
than they look. Two are small.

`.planning/v3/SCOPE.md` remains the decision log for v3. When an item here is
settled it becomes a numbered decision there and leaves this file.

---

## 1. The evidence and check-in flow, redesigned

**Asked for.** Open the camera as soon as Log is pressed on Home, rather than
landing on a screen and pressing again. Then show the shot full size with the
text input and the buttons over the image, so a check-in with a photo and one
without are the same gesture. Drop copy like "Nothing is recorded until you
save." Photos come off a phone, so they are full mobile size and should be
shown that way. Wants several designs to choose between, and artboards.

**True today.** `cameraOpen` starts `false` (`checkin-form.tsx:164`), so a gym
check-in is: press Log on Home, land on `/checkin/gym`, press again to open the
camera, shoot, save. Two presses before the viewfinder. The copy exists twice,
once as a `footnote` default in `camera.tsx:52` and once passed in at
`checkin-form.tsx:414`.

**What the work is.** Two separable pieces, and they should not be confused:

- **Opening the camera on arrival** is small. The screen already knows whether
  the type takes a photo (`type.evidence.level`, `checkin.kind === "camera"`),
  so it is a starting state, not a redesign.
- **The full-bleed capture with the fields over the image** is a genuine
  redesign of the one screen every type shares. Twelve modules draw their
  fields from `fields()`, so whatever is designed has to hold a number input,
  several of them, and none, without a per-type branch (invariant 6).

**Open questions.** Below, Q1 to Q3.

---

## 2. The sign-in screen

**Asked for.** A colour Google mark on the button. And since this is the
landing page for everyone who has never signed in, redesign it.

**True today.** `signin/page.tsx` is a wordmark, one line of copy, a filled
button reading "Sign in with Google" with no mark, and a note about approval.
The copy is stale in a way the request did not mention: it says "A group
accountability contract for nightly sleep. Invite only." That is v1. v3 is a
personal habit tracker with twelve activity types where groups are opt-in.

**What the work is.** The mark is half an hour. The redesign is a real design
job, and it is the only screen a stranger ever sees, so it carries the whole
first impression. The stale sentence should be fixed regardless of whether the
redesign happens.

**Watch out.** Google's branding terms govern what the button may look like
once their mark is on it: their wordmark, their padding, their colours, no
recolouring. That constrains a design more than it sounds.

---

## 3. A streak that moves the moment a session is logged — THIS IS A DEFECT

**Asked for.** "Make sure activities like gym have an instant streak +1 when
marked complete, as streak is per day."

**True today, measured.** It is worse than the request assumes. A brand new
member's first gym session leaves the streak at **0**, not 1, and it stays 0.
Probed on a throwaway account:

```
press               : {"ok":true,"step":"session"}
streak after press  : 0
streak after a read : 0
what a rebuild says : 0
```

**Why.** `bumpStreak` finds no stored row for a type never counted before and
calls `rebuildStreak` instead of adding one (`streak.ts`). `rebuildStreak` asks
`activityDays`, which opens with

```ts
if (scored.length === 0) return { days: [], closedThrough: null };
```

and a member whose first period has not closed has no `activity_scores` row at
all. The early return discards the in-flight days it was about to compute, so
the rebuild answers 0 and the press is thrown away.

**Blast radius, now measured rather than inferred.** Proved for gym, a weekly
type, and for office, a daily one: six of the eight checks in
`bun run check:streak` fail on the commit before the fix. For a daily type the
overnight close repaired it. For gym the week has to end first, so a new member
saw 0 for up to seven days after going to the gym.

**What the work is.** Small and surgical: compute the in-flight days before the
early return, or drop the early return and let the rest of the function handle
an empty history. It needs a check that fails first, in the shape of
`scripts/check-timezones.ts`.

**Fixed 2026-09-08, before the tag.** `activityDays` computes the in-flight
days before the empty case rather than after it, and the empty case returns
them instead of nothing. `bun run check:streak` is the proof and runs in CI:
the first session counts at once, a page read does not take it back, a rebuild
from events agrees, and a second session the same day still adds nothing.

This one closes as §1.12 in `.planning/v3/OPEN.md`.

---

## 4. Checking in after the week's minimum is met

**Asked for.** Gym is three a week. After the third, let them check in on a
fourth day, saying something like "you have already met this week's target, but
you can still add to your streak." Undecided whether the count should read 3 of
3 or 4 of 3.

**True today.** `today.ts:81` is `open: open !== null && !state.passed`. Once
`evaluate` passes the week, `state.passed` is true, so Home shows "done" and
draws no control at all. The fourth session cannot be recorded from Home.

**But the engine already agrees with the request.** `countsNow` only refuses a
second session on the same calendar day, and `daysDone` returns every session
day, so a fourth day WOULD add to the streak if the button existed. The
blocking is entirely in the surface.

**The mock already drew this.** `V3HomeDone.dc.html` carries

```
Gym   13   4 of 3 this week   [done]
```

so a fourth session reading "4 of 3 this week", ticked, was designed and
approved. The build cannot produce that state at all. This is not a new
feature, it is drift from an artboard, which is exactly what the `SCREENS.md`
review gate exists to catch and what ticking those rows would have found.

**Decided 2026-09-08: "4 of 3 this week"**, which is what the artboard says.

**What the work is.** `today.ts:81` stops gating the control on `state.passed`
and gates it on whether another press would count, which the module already
answers with `countsNow`. The row keeps its tick, because the week did pass.
The progress bar has no room past full and needs a decision of its own.

---

## 5. The configure screen, made easier

**Asked for.** Redesign and simplify.

**True today.** One screen serves all twelve types and draws itself from each
module's `fields()` declaration, which is what makes adding a type not touch
the engine (invariant 6). It carries the schedule picker, the day boundary,
grace, and the module's own fields.

**The brief, given 2026-09-08.** All three of these, not one:

- **Too many controls at once.** Schedule, day boundary, grace and the module's
  own fields on one screen, with no grouping and nothing held back.
- **The words are the engine's, not a person's.** Day boundary, grace, period,
  threshold, and none of them explained where they are asked for.
- **Setting a schedule is fiddly.** The day picker and the any-N-per-week
  choice are the hard part.

**What the work is.** A redesign of the screen, and it has to stay drawn from
`fields()` so that adding a type still touches no engine code (invariant 6).
The vocabulary problem is the one that reaches furthest: those words are in the
module declarations and in the admin console too, so renaming them for a person
is a decision about the whole app's language, not one screen's labels.

---

## 6. Activities in group stats do not look clickable — LARGER THAN IT LOOKS

**Asked for.** In group stats the activity rows do not look clickable, so
nobody will click through to per-activity stats.

**Corrected 2026-09-08.** An earlier draft of this file said the destination
did not exist. That was wrong, and it was wrong because the search was for a
per-activity ROUTE. A per-activity view exists on PERSONAL stats at
`/stats?a=<typeKey>`, with a `<details>` disclosure to switch activity, and it
has four artboards behind it: `V3StatsGym`, `V3StatsSleep`, `V3StatsSteps`,
`V3StatsAbstain`.

**True today.** What has no per-activity view is the GROUP stats screen. Its BY
ACTIVITY rows are plain `<div>`s (`group/[groupId]/stats/page.tsx`) and lead
nowhere, and no group-scoped per-activity artboard exists.

**So the choice is narrower than it looked.** Either the rows link to something
group-scoped that has to be designed and built, or they stay rows. Linking them
to `/stats?a=` would be wrong: that is the viewer's own numbers, and a person
tapping an activity inside a group is asking about the group.

**Open questions.** Q6, restated below.

---

## 7. The Decline button on the join screen should be red

**Asked for.** Exactly that.

**True today.** `join-form.tsx:172` renders it `border-rule text-muted`, grey.
Join above it is the filled button. The `penalty` token is the house red and is
already used for the destructive half of the leave-group confirmation.

**What the work is.** One line. The only thing to settle is whether declining
an invite is destructive in the way leaving a group is: a decline can be undone
by asking for another invite, and the screen sits in front of somebody who has
been invited by a friend. Red says "careful". Grey says "the quiet option".

---

## Not in v3.1 unless said otherwise

The v3 list still holds (`.planning/v3/SCOPE.md`): no objections, no open
signup, no native app, no health integrations, no push, no payments, no
app-wide leaderboard.
