# DECIDED.md — what is settled for v4, and what is still open

The running ledger for ROADMAP theme 3. `DIRECTION.md` beside this file is the
PROPOSAL, written 2026-09-19 from `RESEARCH.md`, and it says at its top that
nothing in it is decided. This file is where things stop being proposals.

**Read this first and `DIRECTION.md` second.** Where they disagree, this file
wins, and the disagreement is named below rather than left for somebody to trip
over later.

Aman decided everything in section 1 on **2026-09-20**, in conversation. v4 is
still being thought about, so section 3 is expected to be long and to stay long
for a while. An item moves up out of it, never quietly sideways.

---

## 1. Settled

### 1.1 The app is a coach

Not a clerk. Aman's words: *"I have decided to move away from clerk, I want a
coach as curfew app. DECIDED. v4 curfew will be a coach to help me complete my
activities."*

This is ROADMAP theme 3 being taken, exactly as ROADMAP anticipated. CLAUDE.md
already carried the escape hatch: *"ROADMAP theme 3 decides whether the rest of
the app follows, and until it does, do not carry this register onto a screen."*
It follows.

**Overturns:** CLAUDE.md Voice, the clerk rule, for the app as a whole.

**The RECORD does not follow.** Settled the same day, see 1.11.

### 1.2 AI reads everything a member has, plus what their group shares

Photographs included. Aman's words: *"I want AI on photos etc whatever on all
user's activities data everything."*

Scope, chosen from a menu rather than assumed:

| Can see | Cannot see |
|---|---|
| Your check-ins, scores, streaks, fines | A member's activity they did not share |
| Your evidence photographs | A member's evidence they did not share |
| Group members' SHARED activities and photographs | |

So the sharing toggles keep meaning what they say on screen. A third option,
ignoring them entirely, was offered and not taken.

**Overturns:** "AI-derived nutrition from a food photo" in Not in v3. And a
stronger one that was never written down as a decision because nobody thought it
needed saying: evidence has never been read by anything. `src/server/ops.ts`
still says *"Counted, never read: the console knows how many photos exist and
never what any of them shows."* That sentence becomes false, and the comment has
to change in the same release rather than be discovered later.

**Consequences that are real work, not paperwork:**

- The Phase 9 consent gate carries what Curfew stores. It has to be rewritten
  and republished, and all three members have to accept it again.
  `publish:notice` exists for exactly this and the overlay blocks the app.
- There is no path from R2 to a model. Evidence is private, presigned-read only,
  and nothing server-side has ever fetched an object back. That plumbing is new.
- Nothing in the repo can pay for inference. Paid tiers and any payment
  integration are both in Not in v3 and neither is reopened here.

### 1.3 The coach never scores

Advisory only. Invariant 2 holds: scoring reads `checkin.*` and nothing else. A
model's output is not replayable, so it can be recorded as an event and it can
never decide whether a day counted.

Aman: *"For now only coach but I have an open mind for things we can do."* So
this is settled for v4 and deliberately not settled for ever. Reopening it means
reopening invariant 1 as well, because the moment a model's judgement lands in a
score, `events` stops replaying cleanly into `activity_scores`.

`DIRECTION.md` §5's four hard rules stand: it never scores, everything it says
is recorded as an event, it never invents a number, and off is a real off.

### 1.4 The coach is called Ren, and he is a someone

Chosen over "a tab only" and "woven into the screens only". Lines on the screens
that already exist, plus a tab. The v5 tab bar goes from four to five, which is
exactly Apple's maximum, so nothing else can ever have one.

`DIRECTION.md` section 9 puts coach tier 1 at position seven and has no tab at
all. That order is superseded by 1.7.

**THREE VERSIONS OF THE TAB WERE WRONG AND EACH FAILURE IS WORTH KEEPING.**

**One** was two report cards with a text box underneath. Aman: *"this coach is
really not good at all, no coach figure either."* Nobody was there. It did not
speak first, did not greet you, did not ask you anything, and the one part that
was actually a coach was the smallest thing on the screen.

**Two** gave him a face and then said everything in 22px semibold. A wall. Every
word at the same weight means no word matters more than any other, and the eye
has nowhere to land.

**Three** drew the character as a bell pictogram, 26px, in a rounded square. An
illustrated character had been chosen and an app icon was delivered.

**HIS NAME IS REN.** Short, human, easy to say to a friend, and carrying no
meaning of its own, which was the trade against Juno and Vesper. Both of those
had far better etymology, Juno Moneta being Rome's warner and the root of both
*monitor* and *money*, and neither sounded like somebody you would text about.

**HE IS A BALL WITH A FACE.** The form came from a reference Aman brought: a
soft sphere with dot eyes whose colour carries its mood. That reference is
lavender and mint pastel on cream with a bloom, which is three separate things
the visual tells forbid, so **the form was taken and the palette was not.** Ren
carries each mood's hue through his whole body, in colours the app already owns.
Three things make him read as a sphere, in order of how much each buys: rim
occlusion, one tight specular hot spot, and bounce light. No outer bloom on any
of them, because shading is form and a halo is glow, and the only glow in this
app is IMMACULATE's.

**THE MOTION LIVES IN THE FACE.** Brows, eyes and mouth do the acting; the body
breathes by one part in a hundred and never travels. A ball that lurches around
reads as a loading spinner. The earlier attempts swung and bobbed the whole
sphere, which is what you do when the face cannot act, and they looked cheap for
a reason worth naming: a symmetric ease-in-out loop with no pause is a
metronome. Every cycle now anticipates, damps, and then holds still for roughly
half its length.

**SIX MOODS, ON `Ren.dc.html`.** Resting, Ringing, Done, Angry, Quiet,
Immaculate. **A mood is never chosen**: each answers a value the app already
holds, so nobody can add a seventh because it looked nice.

**ANGRY IS REAL**, decided 2026-09-21, and it fires when a run ends or a grace
is spent on one. It sits against this section's own rule that he never scolds,
and the drawing does not resolve that. Brows tipped in and down is anger and it
is also determination, and which one it is depends entirely on who it is pointed
at. He is furious that Tuesday got you again, on your side, the way a corner man
is between rounds.

    "Right. Tuesday again. We go Wednesday."   correct
    "You knew Tuesday was coming."             scolding, and banned

Nothing in the drawing enforces that. Only the words do, which is why it is
written here rather than left to whoever writes them.

**HE TALKS LIKE A FRIEND IN YOUR CORNER.** Warm, short, never scolds, celebrates
without gushing. Blunt and dry-and-funny were both offered and refused, and they
share a failure mode: in the week somebody is genuinely struggling, the app that
is hard on them or makes a joke is the app they delete.

**HE READS YOUR PHOTOGRAPHS**, and this is the thing no count can do. The app has
always known you logged Food seven days running. It has never known you ate the
same dinner four of those times. *"Four of your seven dinners this week were the
same thing"* is an observation about your life rather than about your
compliance, and it is the whole argument for 1.2.

### 1.4a Where Ren speaks, and where he is silent

The rule: **he speaks where there is a decision or a moment, and is silent where
there is a list or a press.**

| Speaks | Why |
|---|---|
| His own tab | the conversation |
| Home | what to do next |
| After a miss | the moment people quit |
| Your record | reflection, not instruction |
| The day is done | the emotional peak, and the only place he may be pleased |

| Silent | Why |
|---|---|
| Check-in, Declare | time-to-press is the largest-effect item in `DIRECTION.md`, on a six-second budget. He must never be in the way of a press. |
| Groups, Group | other people's space |
| Configure, Standing, Ranks | forms and reference |

**One line per screen, never two.** A voice that comments on everything is noise,
and the tab is where he says more.

**AND HE STANDS DOWN WHEN A PERSON SPEAKS.** If Mira nudges you about Water, Ren
says nothing about Water. A human beat him to it, and two voices about one thing
is worse than either alone.

### 1.5 Seeing who is slipping, and nudging them, is a core pillar

The most substantial thing added on 2026-09-20, and it did not come from a menu.
Aman, unprompted:

> *"Currently we don't show things like what anyone on group has missed but it
> should be core feature as curfew is about two things: tracking your own
> activities, and second is having a helping friend who can nudge you when you
> are slipping."*

So v4 has two pillars rather than one feature list. `DIRECTION.md` §9 has nudges
at position five and treats them as small. They are not small. They are half the
product.

**What exists today.** `memberStandings` gives each member's standing here and
the streaks of what they share. `weekStats` counts the group's last seven days,
passed and failed, with paused members shown rather than vanished.
`groupEvidence` is the shared photographs. So a miss is already visible AFTER
the fact, as a number in a week summary.

**What does not exist.** Any view of who is at risk RIGHT NOW: an open window,
closing soon, nothing logged yet. And no nudge of any kind. There is no
peer-to-peer message anywhere in this codebase. Push exists, but every
notification is composed by the server from `notification-copy.ts`, and no
member can cause one.

Both are new build. The nudge is the first feature in Curfew where one member
can put a notification on another member's phone, which is a design problem
before it is a table.

**Three things settled 2026-09-20, from a menu.**

**It shows AT RISK, not MISSED.** Two different things get called slipping. A
miss is settled, past, and nothing anybody does now changes it, so showing it is
pointing rather than helping, and it turns a screen into a scoreboard of failure
on an app that is careful never to draw the lost number bigger than the next
one. At risk is present and actionable: window open, closing soon, nothing
logged. It is the only state a nudge can move, so it is the only one drawn.

**It lives on HOME**, under your own activities, above the feed. Chosen over
putting it inside each group. Two taps deep is a feature; on Home it is the half
of the product Aman says it is. You see it without going looking.

**A nudge is one of a few set messages, not a text box.** Tap one, it sends.
Free text would make Curfew a messaging app, which needs blocking, reporting and
an answer to what happens when somebody replies, none of which exists. Typing
can be added later once it is missed, which is a thing a week of use will say
and a design argument will not.

**No rate limit**, chosen knowingly over one nudge per person per activity per
day. Three friends who know each other will sort it out. The failure it accepts
is the day somebody is having a bad week and gets nudged nine times.

**Quiet hours still win, and that is not a rate limit.** No limit means no cap
on how many you may send, not permission to reach a phone that is meant to be
silent. Quiet hours is a real setting that nothing overrides (v3.4.0), a nudge
is a notification, and nothing about this decision exempts it.

### 1.6 Fines stay, per group

Aman: *"we will have fines per groups for users to be in check with friends."*

Unchanged from today: integer minor units plus a currency code, IOU only, no
payment integration, append-only ledger, shares summing exactly to the fine.
Invariants 3 and 7 hold.

Consistent with `DIRECTION.md` §8, which keeps money optional and says the fine
should not be load-bearing, because the commitment-device evidence is weaker
than the folklore around it.

### 1.7 One release

Everything lands on one tag: the v5 design, the coach voice, the model, the
coach tab, the peer visibility, the nudges, and the new consent.

Offered and rejected: shipping the redesign first and the AI after.

This will be the longest stretch in the project's history with nothing shipped,
and that is accepted rather than overlooked. It is also why `DIRECTION.md` §9's
build order is superseded: that order exists to sequence releases, and there is
only one.

### 1.8 v5 is the design spec

https://claude.ai/artifact/V5Q54R7heSttj1aXT5PVqP

Twelve artboards in three groups (The tabs, Deeper in, The moments), 390x844,
Ember, iOS dark, true black, system pink, the Apple system face for sentences
and IBM Plex Mono for every number, time, money amount and upper-case label.
Aman: *"this is what we are working on and will implement this, and will be
released finally with curfew v4."*

**Two stale links to fix.** `DIRECTION.md` §10 points the mocks at
`Xchf88QXEYFxugjzYbhdQ9`, which predates this canvas. And
`U6x8pi4khQX5qxBSGEiHyi` is the original, kept deliberately untouched as Aman's
reference. Three canvases exist and exactly one is the spec.

**What this does to `SCREENS.md`.** That file is the review gate and it is keyed
to the `.design/` artboards generated by `build-v3.mjs`. Those artboards are now
the old design, so two files claim to be the spec.

**Decided: leave it until v4 starts, and re-point it in the first v4 commit.**
Both files are true today, because v3 is what is deployed and v4 is not built.
Retiring the gate outright was offered and refused: it is the only thing in the
repo that says a person has to look at a screen on a phone, and the two rows
that matter most, Configure and Check-in, have never been ticked.

**THE CANVAS NOW COVERS EVERY v3 SCREEN, 2026-09-21.** It went from 17 boards
to 37, in nine titled rows, and the twenty added close the gap between what v3
built and what v5 had drawn. Sign in, first run, the consent gate, the catalog,
a release notice, the group's week, its shared evidence, its full ledger, its
settings, an invitation, settings, what you share, notifications, your
photographs, your data, away days, the ops console, and Monk mode in its three
states.

**And the photographs are real.** `public/landing/{food,gym,sleep}.webp` are
uploaded to the canvas and used wherever a member's evidence appears: the feed
on Home, the group feed, the camera and its review, the shared-evidence screen,
your photographs, and Ren's four plates. The layered CSS gradients that stood in
for them are gone.

Those three images are the generated ones, which is the point: a real member's
evidence must never appear anywhere a stranger can reach, and the sign-in board
is exactly that. The same rule that put them on the landing page puts them here.

**Nothing drawn one-for-one from the old `.design/` set.** `V3Admin*` was seven
boards and is one here, Ops, because the scheduler, drift and the controls are
what the console is actually read for. The twelve configure boards are still one
board, Sleep, because that was always the point of the declarative model. The
per-activity stats variants stay inside `Stats`.

### 1.8a The mark, and motion

Settled 2026-09-21, from a menu.

**THE MARK IS `src/app/mark.tsx` AND IT DOES NOT CHANGE.** Three 13-unit squares
on a 32 grid, 2 of margin, 2 of gutter, zero radius, crispEdges, and the fourth
seat empty. It is white, everywhere, always, and it fills with the theme
foreground token rather than a hex so it follows light and dark without a second
asset.

**THE FOURTH SEAT IS NEVER FILLED.** Not on a perfect day, not on anything. The
gap is the identity, and a mark that closes it on a good day is a different logo
for a different company. Filling seats as the day fills was offered and refused
for the same reason: at 1 of 4 it is not a logo, it is a progress meter wearing
the logo's clothes, and Home already has a segmented bar for that.

**`Mark.dc.html` explores a streak-coloured mark AND SAYS IT IS NOT BUILT.** Six
states, streak health: white at rest, pink alive, amber in grace, hollow after a
break, three depths of pink for a long run, gold with the one glow for
IMMACULATE. The board carries an amber note at the top of that section saying
the shipped mark is white, because a sheet of variants left unlabelled is how a
variant ends up shipped.

The alternatives offered were a live mark in the Home header, and a live mark
everywhere. Both were refused: a logo that is never the same twice has stopped
being one.

**ONE EXCEPTION, AND IT IS SCOPED: THE LAVA MARK.** Aman, after the above:
*"how about our icon have a lava inside it we can see from the 3 squares filling
slowly."*

The three squares become apertures cut into black, and behind all of them sits
ONE field, never three.

**The first attempt was rejected and the reason is worth keeping.** Aman: *"No
lava animation is very very bad and AI slop."* It was a water LEVEL with a wave
on it, rising up the seats: a tank filling, which is not what molten anything
does. The reference he sent back was a field of soft bodies drifting, merging
and parting.

So it is a metaball field. Five bodies, blurred and then run through an alpha
ramp, which is what makes two of them become one thing and then two things
again. **Nothing in it is synchronised**: periods of 13, 17.4, 21.2, 26 and 30.6
seconds, sharing no common multiple, and every path asymmetric with its
keyframes off the halves. That is the whole difference from the version that was
thrown out, which had one clock and a wave on a string.

The field BLOOMS on arrival, up from 0.55 over 2.2 seconds, decelerating, and
then it simply lives. It does not fill and empty: a logo that does that is a
loading spinner.

**Two places only: sign in, and the splash.** Everywhere inside the app the mark
is flat and white. That is the line that keeps 1.8a true: the moment somebody
first meets Curfew is a brand moment and gets one treatment, and a tab bar icon
is not.

The shape does not change, the fourth seat is still empty, and the palette is
the app's own: deep #33040f through #c11a3e to #ff375f, with a coral crest. No
gold anywhere near it, because gold is IMMACULATE's and nothing else's.

It is drawn at multiples of 32 wherever it is used, so one grid unit lands on a
whole pixel and the apertures stay as crisp as the flat mark.

Its CSS is opt-in, `HEAD_EMBER` rather than `HEAD`. Two boards show it and
thirty-six do not, and dead rules in thirty-six helmets is how a stylesheet
stops being readable.

### 1.8d The splash, the stamp, and how anybody reaches Activities

Settled 2026-09-21, all of it small except the last one, which was a hole.

**A splash screen exists now.** `Splash.dc.html`. The mark at 192, the field
blooming inside it, and its light spilling past the apertures onto the black,
which is the one reading under which a glow is honest in this app: something IS
lit inside those squares. The word is set down a letter at a time on a 52ms
step, left to right, each one dropping the last 6px. A word that fades in is a
word fading in; a word that lands is a name.

One line under it, "The day is still open", and no spinner. A spinner on a
splash is an apology printed in advance.

**The wordmark stopped being airy.** 20px at 0.3em tracking was a tech-startup
lockup and it fought the mark, which is three solid blocks with a 2-unit gutter.
26px at weight 600 and 0.07em matches it.

**THE STAMP LANDS.** It used to be simply present, which makes it a badge, and a
badge is a participation trophy. It descends from 2.35x, hits at 42% of the
fall, and the page flinches 2.5px. A square ring leaves on the same frame,
square because what struck the page was a square. The overshoot is UNDER the
resting size, never over: rubber compresses, and a stamp that bounces past its
size and settles back is a balloon. The word inks in from 0.5em tracking after
the ink is down, then the icons, then Ren.

**The sample notification wears the mark** rather than a letter C in a pink
tile, which is what a lock screen actually shows.

**Home, lightly.** The mark sits top left at 17px, once, where an app puts
itself. The day's segments fill left to right, 60ms apart. Nothing else.

**AND ACTIVITIES WAS UNREACHABLE BY NAME.** Aman: *"how do someone reach
Activities Page??"*, which is the kind of question that is really a bug report.
The fifth tab said **You** and carried a person silhouette, so it read as a
profile; the screen behind it is titled Activities. The tab now says
**Activities** and its icon is a checklist.

**Settings was worse: nothing in the app linked to it at all.** It was drawn,
and its back button pointed at Activities, and no screen pointed in. A gear now
sits top left on Activities, which is the one bar that had nothing on that side.
It is a plain white glyph rather than 1.8c's red pill, because the pill is for
the one action a screen is for and an escape hatch is not it.

### 1.8c The top-right control has one shape

Settled 2026-09-21. Aman: *"any btn up there in top right corner should always
follow this pattern icon and text and btn filled with our theme red color and
rounded."*

**Icon, then a word, filled #ff375f, fully rounded, 34 high.** Every board that
had a top-right control had a different one: Activities and Groups had a bare
white plus with no label, Configure had a deeper red pill with a word and no
icon, Monk had a grey pill. A bare glyph in a corner is a control people do not
read, and four spellings of the same thing is four things to learn.

`top_action()` in `.design/v5/gen/chrome.py` is the only way one gets drawn now.
Five boards carry it: Activities (Add), Groups (New group), Configure (Save),
Monk (Set up), Monk set-up (Save).

The red is **#ff375f**, the accent, not Configure's old #d81e46. Two reds for
one job was the actual problem and the brighter one is the one the rest of the
app already uses for a primary press.

### 1.8b Reveal motion, on every screen

Aman: *"I love animations like reveal animations and more across pages and
interactions."*

**One motion, not one per screen.** The sections of a screen rise 14px and fade
in on a stagger that DECELERATES: 0, 73, 129, 173, 208, 235ms and then bunching,
so the last few land almost together and the whole thing reads as one gesture
arriving rather than a queue being served. Expo-out, 620ms.

**It runs ONCE.** Nothing on a page of content loops. A loop is for a character,
and Ren is the only character in this app. That rule is what keeps the earlier
verdict, *"animations are very very AI sloppy"*, from coming back: the sloppy
ones were symmetric ease-in-out with no pause, which is a metronome.

Three more, and no more. Bars draw themselves from where they start, after the
section carrying them has landed. Columns grow from their baseline. A press
scales to 0.972 in 140ms and releases on the same curve, because a button that
springs back is a button that argues with you.

**The chrome does not arrive.** The tab bar is exempt from the cascade and only
fades, since a navigation bar that slides in is a navigation bar you cannot hit
yet.

**`prefers-reduced-motion` turns all of it off**, including the press.

It lives in one place, the `<helmet><style>` block every board carries, written
by `.design/v5/gen/motion.py`. Four boards are exempt from the stagger because
their root children are full-bleed absolute layers and rising them one at a time
would pull a photograph off its own viewfinder: Capture, Stamp, Notice and Ren.

### 1.9 The v5 copy is not being rewritten yet

Aman: *"We will make it coach soon. Currently I was focused on theme but soon on
tone etc too."*

So the canvas is the LOOK for now and its sentences are still the clerk's. The
canvas notes say so in its own words: *"nothing is congratulated"*, *"no penalty
red anywhere on the screen"*, *"the lost number is never drawn bigger than the
next one"*. That is the clerk's restraint, drawn well.

This is a known, dated gap rather than an oversight, and the risk goes in
writing here so it cannot be discovered late: Home will sound like a coach and
Configure will still sound like a clerk unless somebody walks all twelve boards
deliberately. That is precisely how v3.3's notifications went wrong.

### 1.10 Nothing has to be migrated gently

Three members, all friends, all reachable. Aman: *"We don't have any real users,
it's just my friends in prod, so it's not like anyone will be surprised by
changes, we can change as much as we want."*

This removes a constraint that shaped v3: no gradual rollout, no compatibility
window, no apologising for a moved button, no keeping a screen because somebody
learned it. It does NOT remove the consent rewrite in 1.2, which is a terms
question rather than a UX one.

### 1.11 The record stays flat. The coach does the talking

Settled 2026-09-20, from a menu. `DIRECTION.md` §2's three registers survive
contact with the coach decision.

- **Warm**: the coach lines, the coach tab, a press landing, a day closing, a
  comeback, push. It may celebrate.
- **Flat**: every number, time, money amount, balance, standing and ledger row.
  A fine reads "₹50, settled" and nothing else.

The reason is that this is what makes the app believable when it does say
something good. A screen where everything is warm has nothing left that is
merely true.

**The structural rule comes with it, and it is the part that matters.** A writer
in the warm register never receives the numbers, so it cannot claim progress it
has not measured. `notification-copy.ts` enforces exactly this today, by not
handing any writer a count, and it was bought with a real defect: production
told somebody with zero of eight glasses that they were almost there, twice,
half an hour apart. Every function in that chain was correct. The sentence was
not.

So "Nice. Water's in." is legal and "Almost there on Water" cannot be written.

### 1.12 ROADMAP theme 1 folds into v4

Settled 2026-09-20. The per-type review does not run first and is not dropped.
Each of the twelve types gets its rules reviewed on the same day its screen is
redrawn.

This answers ROADMAP's argument on its own terms: *"a redesign of screens whose
rules are wrong just makes the wrong rules prettier."* You cannot make a rule
prettier and leave it wrong if fixing it is the same sitting.

The cost is that v4 gets bigger, and it was already one release with everything
in it. That is accepted rather than overlooked, the same way 1.7 is.

**ROADMAP theme 1 is therefore closed as a separate theme.**

### 1.15 First run is a tutorial, and it is deterministic

Settled 2026-09-21. The first time somebody signs in they meet Ren, and he
walks them through setting up their first activities.

**Not a single model call in it.** Every line is written, every branch is a
branch, and it behaves the same way for the third member as it did for the
first. An onboarding that depends on inference can be slow, can be wrong, and
can be down, on the one screen where a person decides whether this app is worth
keeping.

**It cannot be skipped.** You leave it with at least one activity set up, which
is the whole difference between an app you use and an app you opened. Nobody
reaches Home with nothing tracked. The cost is that it must stay to two or
three screens, or the thing people want to escape becomes the tutorial.

It is also where Ren stops being a tab nobody was introduced to. He arrives
having already helped with something.

### 1.16 Monk mode is an aggregate, not an activity

Settled 2026-09-21, and it replaces a worse design of the same thing.

**What was nearly built:** a thirteenth activity type with its own checklist,
its own `checkin.kind`, and a special flag telling the scoring pass to skip it.

**What Aman proposed instead:** *"how about monk mode is an aggregate on
existing activities? You add activities which contribute to monk mode. Hence
monk mode doesn't need to be a real activity, just aggregate score."*

That is better on five counts and the composite design is abandoned.

- **No new module, no new check-in screen.** Nothing is added to the engine.
- **No double entry.** The composite would have had you log 10,000 steps inside
  Monk mode AND inside Steps. The same fact twice is what invariant 1 exists to
  prevent.
- **Derived by construction.** It reads `activity_outcomes`, stores nothing, and
  is rebuildable because the things under it already are.
- **The unscored-type problem dissolves.** It is not excluded from scoring by a
  special flag; it is a reading OF things that were already scored, so there was
  never anything to exclude and no way to inflate reputation with it.
- **Invariant 6 survives.** The aggregate reads `passed` and nothing else, which
  is exactly the engine's public contract. It never learns what a type means.

**THE SET IS EFFECTIVE-DATED.** Add Cold shower to Monk mode today and it counts
from tomorrow. September does not move. This is invariant 5 applied to a view:
resolve the set as it stood on the day being looked at, never as it stands now.
A live set was offered, and it was refused because nothing in Curfew has ever
let a setting rewrite the past, and a score that dropped while you did nothing
is the exact confusion that rule exists to stop.

**A WEEKLY COUNTS ON THE DAYS YOU DID IT, and is ignored otherwise.** Gym is
three a week; on a Tuesday you went, it counts, and on a Wednesday you did not,
it is not asked. So **the denominator moves daily** and a weekly can only ever
lift a day, never drag it down.

One edge that falls out and has to be handled rather than discovered: a day
where nothing in the set was scheduled is **0 of 0**, which is no score at all
and must never render as 0%.

**NO STREAK, NO PASS, NO FINE.** A percentage and nothing else. The activity
whose entire subject is compulsive behaviour is the one thing in this app that
cannot punish you. A bar you clear was offered, and a bar is a pass, a pass is a
miss, and a miss is a thing to dread.

**It is called MONK MODE**, which is what people already call this. "Clean day"
and "Discipline" were both unavailable: the first is how reputation counts
toward IMMACULATE, the second is a rank.

**The score is arithmetic by construction**, so the question of whether a model
produces it closes with this design. Passed over scheduled. Ren reads the number
and says something about the week, which is 1.3 exactly as written.

**MONK MODE HAS ITS OWN REQUIREMENTS**, added 2026-09-21 after the aggregate
was settled. It is not "score whatever you happen to track", or the number means
something different for every person and comparing it is meaningless. All three
of the options offered were taken, so all three apply.

- **Compulsory activities.** A named few that must be in the set. Free: it still
  only reads `passed`.
- **Required categories.** It must cover a body, a food, a mind and a sleep, so
  somebody who runs and somebody who lifts both have a real monk day. Costs a
  category field on each activity module.
- **Stricter limits on a monk day.** Water is 8 normally and 10 for monk
  purposes. **This is the expensive one and it was chosen knowingly.**

**What the third one costs, written down before anybody starts.** One activity
would carry two verdicts for the same day: passed against your own target,
failed against the monk bar. `activity_scores` holds ONE row per user, type and
period, so a second verdict needs a second scope on that table, a second pass to
compute it, and `verify` has to diff both or half the work goes unchecked.

It also changes what Monk mode IS. Reading `passed` makes it a lens. Applying
its own thresholds makes it a second opinion, and the aggregate stops being
free. The cheap version of the same intent, which is not what was chosen, is to
let the member set a harder target on the activity itself.

**IF YOU DO NOT TRACK SOMETHING IT REQUIRES, MONK MODE DOES NOT APPEAR.** Not a
score capped by absent rules, and not a percentage over two easy things. A line
saying what is missing and a button that adds it. Scoring somebody on an
activity they never agreed to do is something no other part of this app does,
and 100% on two easy things is a number comparable to nobody. This also gives
the first-run tutorial (1.15) somewhere to point.


**What this creates:** the conditions Aman named that Curfew does not track yet,
cold shower and no junk food among them, have to become activity types of their
own before they can be aggregated. That is a feature rather than a cost. They
get their own streaks, their own windows and their own evidence, and Monk mode
gets to be nothing but a lens over them.

### 1.18 Sharing a photograph consents to that group's coaches reading it

Settled 2026-09-21, from a menu, and written down on 2026-09-21 after
`scripts/drift/NEXT.md` referenced a section that did not exist.

If you share Food with Wing, Wing's members see your meals, and **their** coaches
read them the same way yours reads yours. Sharing a picture is sharing it with
the coach behind the person.

The alternative is a photograph that three people can look at and no model may
read, which would need the group feed and the coach to hold different copies of
the same picture and would be a promise the architecture cannot keep. Saying it
plainly on the consent gate is the honest version.

This is 1.2's boundary stated from the other end. 1.2 says what Ren may read;
this says what you agree to when you hand something over.

### 1.17 Aman pays for the model

Settled 2026-09-21. Personally, out of pocket, for three members.

This closes the money half of what was 3.2. It does not make the cost
disappear, it makes it somebody's rather than nobody's, which is what was
actually missing: a feature with no funding route is a feature that stops
working the month it gets used.

Paid tiers and payment integration both stay in Not in v3. Nothing in the
product recovers this.

**Which model is now an implementation choice, not a decision**, and it belongs
in the build plan rather than here. What it must satisfy is already written:
the coach never scores (1.3), never invents a number (`DIRECTION.md` section 5),
and everything it says is recorded as an event.

### 1.13 Nudges are refused with one switch, or not at all

Settled 2026-09-21, from a menu. One setting: nudges from friends, on or off.
No per-person mute.

Off means the Nudge button disappears for everybody who can see you, **and they
are not told why**. Nothing announces that you muted anything.

Per-person muting was offered and refused, and the reason is the size of the
group. In a group of three, turning one person off is a thing they will work
out, and the app would have built them a quiet blocklist to work it out with.
One switch has no such shape: either you take nudges or you do not.

There is still no rate limit (1.5) and quiet hours still win.

### 1.14 Ren can be turned off, and off means gone

Settled 2026-09-21. One switch. Off removes the tab, removes his lines from
Home, After a miss, Your record and the day is done, and **no photograph or
check-in of yours is ever sent to a model**.

This is `DIRECTION.md` §5's fourth hard rule honoured rather than softened:
*it is opt-in and switchable off, per account, and off is a real off.* A
half-off that keeps reading your pictures while hiding the tab would make that
sentence a lie.

What is left when he is off is the v3 tracker wearing the v5 design, and that
is a complete app. Nothing in the engine depends on him, which is 1.3 doing its
job: he never scores, so removing him cannot change a single number.

The alternative offered was two switches, Ren and your photographs separately,
so somebody could keep the pattern reader and refuse the camera. It is a
reasonable product and it was not taken.

---

## 2. Confirmed unchanged

Carried from `DIRECTION.md` §8. None of it was reopened on 2026-09-20.

- **Invariants 1, 2 and 9.** Events are the only truth, scoring reads only
  check-ins, a check-in is an explicit press.
- **Invariants 3 and 7**, since money survives. Append-only ledger, integer
  minor units, shares summing exactly to the fine.
- **Invariant 10.** Membership is enforced in the query layer, on every query.
  The coach reading group-shared data goes through `assertMember()` like
  everything else, or 1.2's boundary is decoration.
- **No app-wide leaderboard.** Private groups of four to six is the shape the
  research supports, and Duolingo's leagues are the counter-example.
- **The window is chosen by the member.** This is the fix for the exact thing
  that killed BeReal, whose imposed window became dread. Never take it.
- **IMMACULATE keeps the only glow in the app.**

---

## 3. Open

### 3.1 Which new activity types v4 adds

Monk mode aggregates activities, so the conditions have to exist first. Named
so far: cold shower and no junk food. Steps and Screen already exist. The rest
of "many more things" is unwritten.

Each one is a declarative module and adding a type never edits the engine, so
this is a list to agree rather than a problem to solve.

**What the mocks assume, pending the rest of the list.** Cold shower and No junk
food are drawn in the catalog, marked NEW, and both are a held-or-slipped answer
with no photograph, which is the Sugar-free module's shape and needs nothing new
from the engine. Cold shower is a BODY category and No junk food is a FOOD one,
which is what lets Monk mode's four kinds be covered at all. If the list grows,
the catalog board grows with it and nothing else changes.

**One contradiction, resolved in favour of this file.** `NEXT.md` asked the Monk
mode configure screen for "the pass-at number". 1.16 says NO PASS, in those
words, and gives the reason: a bar is a pass, a pass is a miss, and a miss is a
thing to dread. There is no pass-at number on `MonkSetup`, and `NEXT.md` was
wrong rather than ahead.
