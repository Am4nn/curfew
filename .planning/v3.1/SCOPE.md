# SCOPE.md — v3.1

Seven raw ideas, given 2026-09-08, five more the same day after an hour on the
dev build, and a thirteenth on 2026-09-14. Nothing here is decided when it is written down. Each one is
written as it was asked, then what is actually true today, measured rather than
assumed, then what the work really is and what still needs answering.

**All fourteen are done, finished 2026-09-15.** Four of the first seven turned
out to be defects rather than ideas. §10 and §14 were the two that mattered:
both leaked one member's history to people who should never have seen it.

**One thing here is not code and is not done: §8.6.** Vercel Preview's database
variables still name `curfew-apac`, not `curfew-apac-dev`, so the dev site
reads and writes the branch production is about to become. Nobody asked for it;
it was found only by trying to measure §8.3. It has to be fixed in the Vercel
dashboard before the cutover points production at that same branch.

Two things found after the fourteen, both fixed, both worth reading because
neither could have been caught by anything that existed:

- **The sign-in page's own photographs were behind sign-in.** The middleware
  matcher did not exclude `public/`, so a signed-out visitor got the page and
  every image on it answered 307 with HTML. `bun run check:signin` is the only
  check that runs against a real deployment, because both CI jobs that serve
  the app set LOCAL_MODE, where the gate stands aside entirely.
- **The browser fixture rots at midnight.** Every fixture anchored on the real
  clock calls the seeded day "today", so a run that crosses midnight in
  Asia/Kolkata fails saying a finished counter is not finished. `run.mjs`
  refuses a stale fixture now rather than producing a confident sentence about
  the wrong subject.

**Version: this ships as v3.0.0, not v3.1.0.** v3 never reached production, so
the nine phases and these fourteen items are one release. The folder name is
the record of when the work happened, not a version that shipped.

`.planning/v3/SCOPE.md` remains the decision log for v3. When an item here is
settled it becomes a numbered decision there and leaves this file.

---

## 1. The evidence and check-in flow, redesigned — DONE

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

**A third piece, added 2026-09-14.** The abstinence check-in screen is almost
all text, and it should not exist: answer it from Home and the app is simpler.

**Designed and built 2026-09-14.** Three capture options were drawn and all
three were rejected, correctly, for the same reason: each arranged controls
around a single short number, and this screen is drawn from whatever `fields()`
declares. A design that only works at one field is not a design for it. What
shipped is one layout rule instead of one picture:

> The photograph takes every pixel the sheet does not need.

Gym declares no fields and gets an enormous photograph. Food declares calories
and gets a slightly smaller one. Study declares two fields and no photograph,
so the sheet becomes the whole screen and reads as the form the rest of the app
is made of. Adding a type never touches it.

**The camera opens on arrival**, for every type with a live photograph. It was
two presses from Home to the viewfinder on the app's most-used screen. A type
whose photograph is OPTIONAL gets "Without a photo" on the live view, which
drops through to the fields: opening on arrival must not turn an allowance into
a demand.

**Three controls, each meaning one thing.** The version before this had a cross
and a Discard that did the same job, which is why neither read as anything:

```
the cross   leaves, and nothing is recorded
Retake      throws this frame away and reopens the shutter
Send        records the check-in
```

A photograph you do not want is one you retake or one you walk away from. There
was never a third thing for Discard to mean.

**"Nothing is recorded until you save" is gone**, from both places it lived.

**And an abstinence type is answered on its Home row.** Two buttons under the
row, the same size as each other, because they are alternatives and not a
suggestion with an escape. The old screen was a heading, the question the row
had already asked, two buttons and two paragraphs, reached by a press, to
record one boolean. The route still resolves for anything that deep-links to
it; nothing in the app links there any more.

**Drift, recorded.** `V3CheckinAbstain` and `V3Checkin` draw screens the app no
longer opens from Home. Both are still reachable and still correct for a direct
visit, and the v3.1 artboards are the ones to review against.

---

## 2. The sign-in screen — DONE

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

## 3. A streak that moves the moment a session is logged — WAS A DEFECT, FIXED

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

## 4. Checking in after the week's minimum is met — DONE

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

**No progress bar is involved.** An earlier draft of this section said one had
no room past full. There is no bar on an activity row: it is icon, name,
streak, the module's status line and the tick. The only bar on Home is the
TODAY strip, one segment per activity due today, which a fourth gym session
does not move.

**Done 2026-09-08.** The gate is now whether another press would count, and
that question is asked in one place for every screen. Three things answer it,
none of which is "has the period passed": the window is open, the module's own
`countsNow` says yes, and a step that happens once a period has not happened.
That last one was missing from the engine entirely, so the check-in screen
offered an Arrival form all evening and the press came back "already
recorded".

**It applies to more than Gym, and the two others are worse.** Food passes at
its meal count with the calories under the limit, so the meal that would BREAK
the limit was the one Home refused to take, and the day scored as passed on
what was recorded before it. An abstinence type passes the moment you say it
held, which withdrew the correction `abstinence.ts` deliberately allows in as
many words. Screen time is the same shape as Food.

**Where it does not apply, it is the module or the step that says so**, not
this line. Sleep and Office are unchanged: their steps happen once a period.
Gym's second session on one day is refused as it always was. An unscheduled day
now offers nothing, which is a fourth thing that was wrong: the write path
refused those presses and Home offered them anyway.

**Drift from the artboards, recorded.** `V3HomeDone.dc.html` draws every done
row with a tick and no control. A done row can now carry both, and the control
drops to the secondary treatment (outlined, not filled) so a finished day does
not shout. The artboard is still reachable and still correct: it is the state
after the fourth session, on the day it was pressed.

`bun run check:offer` is the proof and runs in CI. Seventeen checks, four of
which fail on the commit before this one, each one reading Home's own row and
then asking `performCheckin` whether it agrees.

---

## Decided 2026-09-14, so they are not re-litigated mid-build

- **Gym's two weekly numbers: the schedule's `perWeek` wins.** "How often" is
  an engine concept every type can use, resolved as-of the period like the rest
  of scheduling. Gym stops declaring `sessionsPerWeek` and reads the target
  from the schedule it is given; it still decides whether the week passed, so
  nothing in the engine learns what a session is (invariant 6). This unblocks
  §5, which cannot draw one "how often" row while two numbers exist.
- **The plain-English rename reaches everywhere, admin included.** One
  vocabulary, not two. It touches the module declarations, the configure
  screen, the admin console and the artboards, and it is the largest single
  piece of §5.
- **The landing page's three photographs are generated, and the caption drops
  the word "real".** They cannot be members' evidence: the sign-in page is the
  one screen served to people who are not signed in, and putting anyone's
  check-in on it would break the promise the page makes three lines above.
  They are static files under `public/`, never R2, which needs a presigned URL
  and a CORS origin a signed-out visitor does not have.
- **Build order: §1, §2, §12, then §5.** The first three are contained. §5 is
  666 lines plus a new method on twelve modules plus the rename, and goes last.

---

## 5. The configure screen, made easier — DONE

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

## 6. Activities in stats do not look clickable — DONE

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

**Corrected again 2026-09-08, by the person who asked for it.** The screen
meant was PERSONAL stats, not group stats. There the rows under BY ACTIVITY
have always been links to `/stats?a=<typeKey>`, and nothing on them said so: no
chevron, no press state, on a row shaped exactly like Home's, which is not a
link. The shape reads as a line of a table, so the four charts behind it went
unopened. The artboard drew it that way too, which is how it got built that
way.

**Decided and done 2026-09-08.** The chevron the starter rows and the photo
strip already use, the press state every other control has, and the section
header saying it in words: `BY ACTIVITY, LAST 30 DAYS` on the left,
`TAP FOR THE CHART` on the right, the same shape as `YOUR PHOTOS` and its
`All ›`. A 12px glyph on the far edge of a dense row is not enough to rest a
screen on. Two artboards regenerated with it, `V3Stats` and `V31StatsPaused`,
and the screens suite now follows a row through to the chart it opens.

**The group screen is untouched, and stays that way for now.** Its BY ACTIVITY
rows are plain `<div>`s that lead nowhere, so there is no affordance missing:
there is no destination. Giving them one means designing something
group-scoped, because linking them to `/stats?a=` would answer a question
nobody asked: that is the viewer's own numbers, and a person tapping an
activity inside a group is asking about the group. Not in v3.1 unless it comes
back as its own request.

---

## 7. The Decline button on the join screen should be red — DONE

**Asked for.** Exactly that.

**True today.** `join-form.tsx:172` renders it `border-rule text-muted`, grey.
Join above it is the filled button. The `penalty` token is the house red and is
already used for the destructive half of the leave-group confirmation.

**Done 2026-09-08.** Red, `destructive`, the same treatment as Stop tracking.
Declining revokes the invite and the sender can see it, so grey was saying "the
quiet option" about the one thing on the screen that is not.

**Home and Groups carry the same word for the same action**, through
`InviteRows`, and they were grey too. Both are red now: one action, one colour,
wherever it is offered.

**No artboard drew it.** The join screen's mocks, `V3JoinSetup` and
`V3JoinShare`, end at Join group; the Decline beneath it was added in the
build. The invite card that Home and Groups draw did have one, and it is red in
the mock now as well.

---

## 8. Five things wrong on the activity screens — DONE, except 8.6

Given as one bullet, measured as five separate faults, plus a sixth nobody
reported that was found while trying to measure the third.

### 8.1 Water and Food take a press as often as you like — DONE

**Asked for.** A customisable gap between logs.

**True today.** Water's only field is `glasses` and Food's are `meals` and
`calorieLimit`. Nothing spaces the presses. The only limits are the abuse
ceilings in `checkin.ts:281`, 20 a minute and 50 a period, which exist to stop
a stuck button rather than to describe a day. Eight glasses can be logged in
eight seconds and the day passes.

**What the work is.** A minimum gap between presses of a repeating step.

**Decided and done 2026-09-08.** Honesty, so the press is refused rather than
recorded and ignored. Engine-owned, beside `grace`: 0 to 240 minutes, per
activity, off by default and defaulted in the schema so every config row
written before it still parses. The engine writes the one sentence about it,
since it is the engine's rule: "1 of 8 today. Next counts 12:22 AM." Enforced
in both places, because either alone is a bug: the write path refuses with
`too_soon`, and the step is not open while the gap runs, so no control is
offered that the write path would refuse. The control appears only on a type
with a step that repeats, since there is nothing to space out on an arrival.

### 8.2 "I slipped" looks like it does nothing — DONE

**Asked for.** Sugar-free's "I slipped" does nothing.

**True today.** The server takes it. `bun run check:offer` proves the
correction lands and flips the day from passed to failed. What is missing is
any words: abstinence declares no `hint`, so the row's status line reads
`Logged 10:15 PM` whichever answer you gave, and the tick is the only thing
that moves. Press "I slipped" on a day with nothing declared yet and literally
nothing on the row changes.

**Done 2026-09-08.** The abstinence factory writes a `hint`, so the row says
which answer stands: "You said it held." or "You said you slipped. Today does
not count." In the module's own words, like every other type's line.

### 8.3 Food asks for another Log after four — DONE, AND IT WAS MINE

**Asked for.** "Food I logged 4 times but it just keeps on asking for Log."
Corrected by the person who reported it: nothing failed, the photographs were
captured and sent, and the count moved. The complaint is only that the button
did not go away.

**The check-ins recorded.** Confirmed by the person reporting it: the line
under Food counted up as each meal was logged. So the photographs went through,
the events exist, and nothing about the upload path is implicated. What is left
is why the control stayed, and there are exactly two candidates:

- **The day failed on calories.** Food passes only when the meal count is met
  AND the total is at or under the limit. Four meals over 2000 leaves the day
  failed, so no tick, and the control is correct to stay. **Nothing on the
  screen says the day can no longer pass.** The line states the two numbers and
  leaves the reader to do the comparison, which is not the register this app
  writes in: it states consequences.
- **The day passed and kept its control**, which is the change made earlier the
  same day, deliberately, so that the meal breaking the limit can still be
  logged. If this is what was seen, the question is whether Food should be in
  that rule at all.

The row's exact wording separates them in one glance, and reading it needs the
database the dev site actually uses. See §8.6.

**Settled 2026-09-14 from the deployment history, which answered it without
the database.** It was the second candidate, and it was built 45 minutes before
it was reported:

```
cd2d0ec  09-08 21:44  A control was offered on the wrong question   (§4)
         09-08 21:59  deployed to dev as pxdehq5lt
62ee6b8  09-08 22:48  Five more, and one of them is that evidence does not work
```

So dev had been serving the change for the best part of an hour when it was
hit. Nothing was failing on calories, and nothing was broken: Food had met its
count, kept its control on purpose, and said nothing about why.

**The control stays, and that is not in question.** Food passes at its meal
count with the total under the limit, so the meal that would BREAK the limit is
the one meal a vanishing control refuses, and the day then scores as passed on
what was recorded before it. That is the app rewarding not logging, which is
what invariant 2 exists to forbid. Screen time is the same shape.

**What was actually wrong is that nothing drew the line between an offer and a
demand.** A row reading `3 of 3 meals · 1450 of 2000 cal` with a tick and a Log
button is genuinely ambiguous, and the reasonable reading is the one that was
reported: it has not noticed it is finished. The engine now says it, because
whether another press would be taken is the engine's rule and not the module's:

```
600 so far today. The limit is 700. Another still counts.
```

`bun run check:offer` covers it and fails on the commit before.

**The first measurement of this was against the wrong database**, and finding
out why is the important part, so it is kept below rather than deleted.
Everything that follows was read from `curfew-apac-dev`, which is what
`.env.preview` names and NOT what `dev.curfew.amanarya.com` writes to. It is a
snapshot taken when the branch was cut, so it holds nothing from the session
being reported. What it shows is still true of the days it covers, and it is
still worth explaining: of **39 photo tickets issued in those days, exactly one
became a check-in.**

```
evidence  gym   21 rows,  1 confirmed
evidence  food  18 rows,  0 confirmed
events    checkin.gym.session   1   (2026-09-04)
events    checkin.food.meal     0   ever
```

Four food tickets were issued within three seconds of each other, which is a
person pressing Send again because nothing happened. Whatever it was, it was
happening on 4 September and it is not what was reported this week.

**This is the path `OPEN.md` §4 says has never been driven end to end**, and it
is the app's flagship feature. Evidence is the reason a group can believe
anything.

**R2 CORS is ruled out.** `bun run check:cors` passes for both
`http://localhost:3000` and `https://dev.curfew.amanarya.com` against
`curfew-evidence-dev`. Per-commit `*.vercel.app` URLs are on no allowlist and
never were, so a test from one of those would fail in exactly this way and is
the first thing to eliminate.

**What is left, and how to tell them apart.** The ticket is issued, so the
failure is after it: either the browser's PUT to R2, or `checkInAction`
refusing. Food's evidence schema requires an integer `calories`, so a blank or
unparsable field returns `invalid` and no event, which would look identical
from the database. The upload half can be exercised without a browser by
requesting a ticket, PUTting to the presigned URL from a script, and calling
the action, which separates the two in one run.

**And a defect of its own.** A photograph that never became a check-in leaves
an evidence row, no event, and no record anywhere of why. The app cannot say
afterwards what happened to 38 photographs. Whatever the cause turns out to be,
that silence is worth closing.

### 8.6 The dev site writes to the future production database

**Not reported. Found while trying to measure §8.3**, which is the only reason
it was found at all.

`CLAUDE.md` says `main` is a Preview deployment against `curfew-apac-dev`. It
is not. `bunx vercel env ls preview` dates `DATABASE_URL_POOLED` and
`DATABASE_URL_DIRECT` at six days old, and the `curfew-apac-dev` branch was
made after that. The branch was named in the local `.env.preview` file and
never in Vercel, so `dev.curfew.amanarya.com` has been reading and writing
`curfew-apac`'s default branch: the database production is about to become.

**Three consequences, in the order they bite.**

Every measurement taken from `.env.preview` describes a database nobody is
using. That is how §8.3 came to be written about 39 photographs that are not
the 39 in question.

Every test press made on the dev site is sitting in the future production data,
which decision 22 says starts empty. The cutover already wipes it, so this
costs nothing as long as the wipe happens; it is the assumption underneath the
wipe that is worth stating out loud.

And `bun run migrate` applies to a branch the deployed app never reads, so a
migration can pass locally and be missing where anyone is actually looking.

**What the work is.** Point the Vercel Preview environment at
`curfew-apac-dev`, redeploy, and confirm from the app rather than from a file.
Then say in `CLAUDE.md` that the environment files describe local commands
only, and that what a deployment reads lives in Vercel and is checked with
`vercel env ls`.

### 8.4 A gym session does not move today's count — DONE

**Asked for.** "Gym done even then progress 2/5 doesn't go 3/5."

**True today.** `today.ts` sets `done: state.passed`, and Gym's period is a
WEEK. So a session today moves Home's TODAY strip not at all until the whole
week passes, and once it does, Gym reads done for every remaining day of that
week whether or not you go again. The strip counts periods passed, not work
done today, and for eleven of the twelve types those are the same thing.

**Found beside it.** This account's Gym carries two different weekly numbers:
the schedule says `minimum, perWeek 4` and the module config says
`sessionsPerWeek 3`. One screen sets both and nothing reconciles them.

**Done 2026-09-08.** The count reads `countedToday`, which is true when
nothing more is wanted from today or when today is one of the days the module
counts. Identical to `passed` for the eleven daily types; different for a
longer period in both directions, since a rest day in a week already met is not
a shortfall either. The tick beside the row is still `passed`, which is the
period. `daysDone` is the module's own answer, so nothing in the engine learns
what a session is.

**The two weekly numbers are still there.** A minimum-per-week schedule and a
module's own `sessionsPerWeek` are set on one screen and nothing reconciles
them. Left alone deliberately: it belongs with #5, the configure screen.

### 8.5 Calories accepts nought and five digits — DONE

**Asked for.** No more than four characters, and not zero.

**True today.** `foodEvidenceSchema` is `z.number().int().min(0).max(20000)`
and the field is declared `min: 0, max: 20000`, so `0` is accepted and so is
`20000`. A meal of no calories is not a meal.

**Done 2026-09-08.** 1 to 9999 in both the schema and the field: one meal, not
a day. And the input itself, which was the real hole: `min` and `max` on a
number input are checked when a form is submitted and never while anyone types,
and this is not a form, so five digits went in and the server refused them
AFTER the photograph had been uploaded. Digits only now, never past the
ceiling, and Send stays down below the floor.

---

## 9. Photographs cannot be opened — DONE

**Asked for.** Any photo should be clickable. Needs a UI.

**True today.** `photo-tile.tsx` renders a bare `<img>` inside an
`aspect-square` with `object-cover`, so a photograph taken on a phone is
cropped to a square and there is no way to see the rest of it. Nothing in the
app opens one: not `/settings/photos`, not the strip under a chart on Stats,
not the group's evidence tab. The only tile ever wrapped in a button is the one
on the delete-data screen, and that button deletes.

**Done 2026-09-08.** An overlay: the picture whole, `object-contain`, with who
and what and when under it, Escape to close and arrows through the set. Both
grids use it, your own photos and a group's evidence tab, where the arrows stay
inside the day the heading names.

**The three questions, answered by building it.** An overlay rather than a
route, because it is a closer look at something already on screen rather than a
place to arrive at, and an address for a photograph would outlive the sharing
that allowed it. No actions on it: deleting your own lives on the photos and
delete-data screens, reporting somebody else's on the evidence row, and a
viewer that could do either would be a third place to do both.

---

## 10. Evidence never reaches the group — WAS A REAL BUG, FIXED

**Asked for.** "Why are evidences not getting shared with groups? I did share
them and agreed to sharing in settings."

**Measured: the sharing is right and there is nothing to share.** Every one of
the six types that group accepts resolves to `shared: true` and
`share_evidence: true` for this member, as of now. The feed's filters are
correct. What is missing is the photographs: `groupEvidence` requires
`confirmed_at`, and there is exactly **one** confirmed photograph in the whole
database. The other 38 never became check-ins, which is §8.3.

**That reasoning was wrong, and closing this on it was the mistake.** The
sharing being right and the photographs being few said nothing about the query
that reads them, and it was the query. It took being told a second time,
against a flat claim that this needed nothing, to go and look.

**Fixed 2026-09-08.** `groupEvidence` selected on the member, ordered by
`confirmed_at DESC`, took the first page and THEN dropped the rows that were
unconfirmed or of a type that member does not share evidence for. Postgres
sorts nulls FIRST on a DESC order, so every abandoned upload sorted above every
real photograph. Opening the camera and not sending leaves one behind, which is
ordinary. Twenty of those filled the page, all twenty were dropped in the loop,
and the tab said "Nothing shared here yet" to a group whose members had been
sharing photographs for days. Enough abandoned uploads and it says that
permanently.

A limit applied before the filters is a limit on the wrong thing. Every filter
is now in the WHERE: the member and the types they share evidence for as one
condition, confirmed, not deleted. The loop's own checks stay as a second line.

`bun run check:evidence` is the proof and runs in CI. One photograph and 45
abandoned uploads taken after it, which is the shape of the account this was
reported from. Two of its three checks fail on the commit before, with nought
items back, which is the tab saying nothing was ever shared.

**And the tab stopped saying that when it means something else.** A photograph
whose URL cannot be signed is dropped per item, so one bad row cannot take the
page down; with every row dropped, the message read as a quiet group. It now
says the photographs could not be loaded and that nothing has been deleted.

---

## 11. The ceiling reads 1000 whatever you actually do — DONE

**Asked for.** "In a group where I haven't added many of the activities it
accepts, the ceiling is still 1000. Why?"

**Two separate causes, both measured.**

**Breadth counts toggles, not activities.** `scoring.ts` computes
`breadth = accepted-and-shared / accepted`, and "shared" is a row in
`member_shares`. It never asks whether the member tracks the type. This
account shares all six types the group accepts and tracks three of them: Food,
Gym and Sleep. Office, Study and Supplements are shared and untracked, so they
can never produce a period, can never be missed, and cost nothing. Breadth is
1 and the ceiling is 1000. Sharing something you do not do is free score.

**And the default is the maximum.** `group-view.ts:226` reads
`ceiling: rows[0] ? Number(rows[0].ceiling) : 1000`. With no scored day yet, a
new member and everyone still in grace is shown 1000, which is the one number
that is certainly not theirs.

**The display half is done 2026-09-08.** With no scored day the ceiling is now
`ceilingFor` of what the member shares of what the group accepts, the same
arithmetic the nightly pass uses, rather than a literal 1000. The breadth line
beside it counted every share row, which could report more shared than
accepted; it counts what the group accepts too.

**The scoring half waits for a decision**, and the person who asked is right
that the rule as designed is shared over accepted: share all six and the
ceiling is 1000. The question is only whether a type you share and do not track
should count toward it, since it can never produce a period and so can never be
missed. Changing it changes how a day is scored, so it is a `LOGIC_VERSION`
bump and a `verify` run, not a one-line edit.

**Open question.** What is a tracked type, for this purpose: enabled today, or
enabled on the day being scored? Invariant 5 says the second, and
`user_activities` is already effective-dated, so the answer exists. It is the
difference between un-tracking something raising your ceiling retroactively and
it raising it from today.

---

## 12. Group settings are as scattered as the configure screen — DONE

**Asked for.** The simplification asked for on the configure page is needed in
group settings too. Everything is scattered.

**True today.** 581 lines over two files, and five labelled sections in one
scroll: what you share, the group's accepted types, money and fines, the rules,
and invites out. It mixes what only you can change, your two sharing toggles,
with what only an owner can, the money and the invitations, and does not
separate them.

**What the work is.** The same brief as #5, and it should be designed with it
rather than after it: fewer controls in front of anyone at once, no engine
vocabulary, and the owner's half kept apart from the member's half so nobody
scrolls through decisions that are not theirs to make.

**Done 2026-09-14, on #5's pattern deliberately.** One vocabulary for both
settings screens was the whole of the original ask, so this is the shape #5
settled on rather than a second invention: a sentence saying where you stand,
then a list where every row is one decision, then that decision on its own
screen.

Two halves behind one switch. A member sees no switch at all rather than a
greyed one, because a greyed control is a thing somebody might one day press.

```
YOURS                       THE GROUP  (owner only)
  What this group sees        Activities it accepts
  What it costs you           Members
  Leave group                 Fines
```

**A panel is a query parameter, not a route.** One page component, one set of
queries, and Back leaves the panel rather than the group. It also means a link
to one half is a link somebody can send.

**The owner-only panels are refused in the page, not hidden in the component.**
A member who types `?panel=money` gets the hub. A control that is merely not
drawn is a decoration, not a permission.

**The ceiling in the opening sentence is the real one**, read from `standingIn`
rather than described in general terms, so the screen says what the nightly
pass actually did. That is the number §11 fixed.

---

## 13. Deleting a photograph makes you wait — DONE

**Asked for.** Deleting a photo should be asynchronous. It takes a long time
and the person sits there.

**True today.** Both delete paths do the work inside the request, and the bulk
one does it one photograph at a time. `deletePhotos` (`deletion.ts:95`) loops
over every row and awaits an R2 delete and then an UPDATE for each, in series,
so forty photographs are forty round trips end to end from `sin1` to the
bucket, with the person watching a spinner for all of them. `deleteOnePhoto`
is the same shape for one.

**The order is deliberate and it is what costs the time.** The object goes
before the row is marked, so a row can never say deleted while the file is
still in the bucket. That is the right way round for a promise about somebody's
photographs, and it is why the work cannot simply be dropped.

**What the work is, and the catch.** Marking the row first and letting the
nightly sweep remove the objects would return at once, and a row marked deleted
is already invisible everywhere: every screen filters on `deleted_at`, and the
file is unreachable without a presigned URL, which is only ever issued for a
live row. **But nothing would then remove the object.** `sweepEvidence`
(`evidence.ts:269`) has two cases, retention and abandoned uploads, and both
select `deleted_at IS NULL`. A row marked deleted whose object survives is
picked up by nothing at all, so the file would sit in the bucket for good.

So this is three pieces, not one:

- A third sweep case: rows marked deleted whose object has not been removed.
  That needs the two facts held apart, which the schema does not do today: a
  `deleted_at` says both "the person asked" and "the file is gone". A second
  column, or a retry queue.
- Return before the objects go, so the screen is instant.
- And whatever the answer, delete the objects concurrently rather than one
  after another. Forty sequential round trips is slow even in a background job.

**Open question.** How long may a file outlive the press that deleted it? The
consent copy and the terms both say what happens to photographs when you delete
them, and "tonight" is a different promise from "now". If the answer has to be
"now", the honest version is to keep the delete in the request and only make it
concurrent, which turns forty round trips into one wait.

---

## 14. A group sees what you did before you joined it — DONE

**Asked for.** Groups should only show evidence from after the member joined or
the group was made, not everything.

**True today, and it is the more serious kind of bug in this file.**
`groupEvidence` filters on the member, on the types they share evidence for, on
confirmed and on not deleted. There is no date in it anywhere. So joining a
group with evidence sharing on hands over the entire back catalogue: track Gym
for a year, join on a Tuesday, and the feed opens on a year of photographs
nobody in that group was ever entitled to see.

Nothing about it looks wrong from inside the app, which is why it lasted. The
sharing toggle reads as a decision about what happens next, and it was
answering a question about the past as well.

**Done 2026-09-14.** Each member is bound by their OWN join date rather than
the group's, so somebody who arrived last week does not inherit a founder's
view. The cutoff is a condition in the WHERE beside the other three, for the
reason §10 is about: a filter applied after the limit is a filter on the wrong
rows.

**The cutoff is built in the member's zone, not UTC.** `joined_at` is a date
and carries no time, so the instant has to be made, and midnight UTC is half
past five in the morning in Kolkata and falls in the PREVIOUS evening west of
Greenwich. Building it in UTC would leak exactly the photographs this exists to
hold back, for every member in a zone behind it.

`bun run check:evidence` grew two checks and both fail on the commit before: a
photograph confirmed a month before the join date, passing every other filter
the function has, came back in the feed.

**Left alone deliberately.** Someone who leaves and rejoins is bound by the
join date of their current membership, so the gap they were away is closed
along with everything before their first arrival. Whether a group should keep
seeing what it already saw during a previous stint is a real question and
nobody has asked it.

---

## Not in v3.1 unless said otherwise

The v3 list still holds (`.planning/v3/SCOPE.md`): no objections, no open
signup, no native app, no health integrations, no push, no payments, no
app-wide leaderboard.
