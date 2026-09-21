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

### 1.4b Ren wears no crown, and IMMACULATE does not need one


Tried twice on 2026-09-21 and dropped. The first attempt invented a crown out of
three square teeth to echo the mark; the second used the real one, from
`src/app/rank-icon.tsx`, which `Ranks.dc.html` has drawn the rank with since v3.
Both were awkward, and the second one settles it: **the shape was never the
problem.**

A crown on a sphere with a face is a hat on a ball. There is nowhere on a sphere
for a hat to sit, because a sphere has no head to be the top of. Every angle
reads either pasted on the front or balanced on nothing.

**IMMACULATE already says what it is.** The skin goes gold, the expression is
composed rather than pleased, and 1.4's mood pass gave it the one thing it was
missing, which was a face of its own rather than DONE's in another colour.

**The crown stays on the rank tile**, where it works: an emblem inside a ring is
a symbol on a surface, not an object balanced on a curve. That is also the only
glow in the app and it does not need a second home.

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

**The logotype gets its own face, and it is the only thing that does.** IBM Plex
Mono was doing a logotype's job. A mono gives every character the same width,
which beside three solid blocks reads airy where the mark reads dense; tracking
it tighter helped and did not fix it, because the problem was the face.

**Archivo at 900, tracked IN at -0.03em.** It has the mark's density. It loads
only on the boards that carry a logotype, through `HEAD_EMBER`, and **every
number, time, money amount and upper-case label in the app is still IBM Plex
Mono.** Nothing about `CLAUDE.md`'s typography rule changes: one display face
over the body face is the shape that rule already describes, and a logotype is
the one place it applies.

**IT IS SPACE GROTESK AT 500, AND IT TOOK THREE WRONG ANSWERS TO GET THERE.**
Worth writing down, because the reasoning was backwards the whole time.

- IBM Plex Mono at 0.07em: *plain*. A mono gives every glyph the same width.
- Archivo 900, default width: *plain*. That width is a TEXT width.
- Archivo 900, expanded to 125: *bulky*.

Each attempt added weight, and weight was the wrong axis. **The mark is three
solid blocks: it already carries all the mass a lockup needs.** A heavy word
beside it is two heavy things competing, which is what bulky means. What the
word has to carry is the NAME, and it needs character rather than weight to
avoid reading plain at 500.

Space Grotesk has that character in its letterforms, so it is neither. It loads
beside Archivo through `HEAD_EMBER`, and every number, time, money amount and
upper-case label in the app is still IBM Plex Mono.

`Mark.dc.html` draws all three settings side by side with the live one ringed,
so the next round of this is a pointing exercise rather than a description.

**One splash, and it kept the rejected candidate's line.** B was dropped, but
*"Windows close. Be there."* was the better sentence and it moved onto A. It is
set in the body mono, small and tracked out, so it sits UNDER the logotype
rather than competing with it: a tagline in the same face as the logotype is a
second logotype.

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

### 1.8e Where Settings lives, and what the tab bar does


Settled 2026-09-21, after *"Fix the bottom bar everywhere, it should be
consistent... where does Settings go?"*

**THE FIFTH TAB IS ACTIVITIES AND THAT IS FINAL.** It is what the screen is.

**Settings is not a tab. It is YOU, and it is one page.** Profile at the top,
settings under it: the picture, the name, when you joined, who invited you, then
your details, then Ren and nudges, then what others see, then the app, then sign
out. Two pages would be two routes to remember and a profile screen carrying
four facts, which is a screen nobody opens twice.

**It is reached from the avatar on Home and from nowhere else.** That avatar
already existed and pointed at Activities, which is why nobody could find
Settings: the one control shaped like a profile went somewhere else. The gear
added to Activities the day before is removed, so there is exactly one way in.

**The picture is initials until there is a photograph.** A grey silhouette is a
face that is not yours, and this app is careful about whose face is where.

**The rule for the tab bar, and it is now true of every board.** A page that
sits INSIDE a tab keeps the bar, and the tab it sits under stays lit. A
full-screen moment or a gate has no bar at all.

Four pushed pages were missing one and now have it: Configure and Ranks under
Activities, Standing under Groups, and the two switches under Today. Everything
in the You stack says Today, because that is the tab it was pushed from. The
fourteen with no bar are the moments and the gates: Splash, Signin, Welcome,
Consent, Notice, Invite, Capture, Declare, Stamp, Restore, Nudge, Mark, Ren,
Admin.

**Checked row for row against the real screen.** The first draft of You carried
eleven rows and `src/app/settings/page.tsx` carries thirteen, so half of it was
missing: appearance, grace, pause, photo retention, what Curfew stores, the
rules and delete data, plus the three v4 adds. Seven groups now.

Two things moved rather than being copied:

- **Grace and away days sit under HOW YOU ARE JUDGED**, beside Activities, Monk
  mode and how standing works. They are rules the app applies to you, not
  numbers you set, which is v3.2 item 19's reasoning carried across.
- **"What Curfew stores" and "The rules" are one row**, pointed at the consent
  gate, because in v4 that gate carries both.

**Appearance is three states and not two.** Somebody who wants the phone to
decide is not choosing dark, and a two-way switch makes them choose anyway.

**ADMIN IS HERE, AND IT IS THE ONLY WAY IN.** Ops had no route from anywhere in
the app: the board existed and nothing pointed at it. One row, shown only to an
account that has it, with the scheduler's state as its value so a glance
answers the question the screen exists for.

### 1.8f No version number where a member can see it


Settled 2026-09-21. Aman, on the consent gate's `CURFEW 4.0`: *"never have a
version because it is never a thing people will know unless they are devs, hence
it is only in Admin."*

Removed from the consent gate (the eyebrow is `NEW TERMS`), from the release
notice (`WHAT'S NEW`) and from the foot of You. **Admin keeps
`PRODUCTION · 4.0.0`**, because that screen is read by somebody deciding whether
a build shipped, and there the number is the whole point.

The consent gate's title went with it: *"What changes, and what you are agreeing
to"* ran to three lines at 34px. It is **"Before you carry on"**.

**"Invited by Mira" came off the profile** in the same pass. A profile says who
you are, and who brought you in is a fact about the group rather than about you.

### 1.8g A one-shot animation cannot be reviewed on a canvas


Settled 2026-09-21, from *"what happened to day is done stamp, any changes?"*
The landing HAD been built the day before. It runs once, on load, so by the time
anybody scrolls to that artboard it has already happened and the board looks
exactly as it did before the work.

**So `Stamp.dc.html` repeats on a 7.6 second cycle, and the screen does not.**
Every duration, curve and offset is the real one, expressed as a percentage of
the cycle instead of a delay; the repeat is a property of the BOARD. The overlay
fades out at 96% and returns, which is also the only honest way to loop it: the
stamp does not re-stamp, the screen re-opens.

There is precedent in the repo. `.design/` already carried
`V3DayCompleteMotion` and `V3RecordedMotion`, artboards whose whole job was to
loop a motion spec. This folds that idea back in rather than inventing it.

**The general rule this sets:** any board whose point is a one-shot animation
loops on the canvas and says so in a comment. Otherwise the work is invisible to
the only person reviewing it.

### 1.8h The consent gate is the real document, at its real length


Settled 2026-09-21. Aman: *"the consent gate is missing a lot, our current one
makes users agree on a lot of things, sharing policies etc, where did that all
go?"* It went nowhere: the mock never had it. Four bullets stood in for
nineteen sections, which made a legal document look like a welcome card.

**The copy is lifted from the code, section for section.** `CONSENT` in
`src/server/consent.ts` is ten sections and `TERMS` in `src/server/policy.ts` is
nine. All nineteen are on the board, plus one v4 section, **REN, THE COACH**,
placed first because he is the change and nobody re-reads the other ten for
fun. One line was added inside WHAT A GROUP SEES, which is 1.18.

It is the tallest board on the canvas by a distance, in its own row, and that IS
the design. This is a long thing to read with no way around it, and a mock that
hides the length hides the only hard part of the screen.

**The first attempt at it was accurate and ugly**, which Aman said plainly:
*"the consent gate doesn't look good like the preview one looked in v5."* It
was nineteen headings of naked bullets on black, which is a wall rather than a
screen, and the v5 board it replaced had looked good precisely because it used
the house idiom.

So every section is a CARD now, with its icon in a tinted chip and its heading
in mono, exactly the way every other board on this canvas presents a group of
facts. The tint separates the two documents at a glance, pink for what Curfew
stores and amber for the rules, and the part label says which is which so the
colour is never the only thing carrying it.

**The four sentences that matter most sit at the top**, in the shape the old v5
board had: Ren reads everything, a photo you share is read for them too, he
never scores, off is real. Somebody who reads nothing else has to hit those
four, and burying them at position seven of nineteen was the real failure of
the accurate version.

**Nothing is behind a disclosure.** An accordion would have halved the height
and it was refused: a consent gate that folds its terms away behind taps is the
exact dark pattern this app is careful not to be.

**"NEW TERMS" was wrong and the reason is worth keeping.** Aman: *"for first
time users its first time, not a new term. It's a gate."* Both readings are real
at the 4.0 release: three existing members meet it as a re-accept and everybody
after them meets it as a gate. It is **one screen with two framings**, switched
by a `returning` tweak in `data-props` rather than by a control, because the
difference between them is two sentences and a `data-props` lever is what this
canvas has for exactly that.

- Default: **"Before you carry on"**, and *"there is no way past this page and
  no dismiss on it."*
- Returning: **"Three things changed"**, and what is new is named.

There is no eyebrow over either. `BEFORE YOU START` above `Before you carry on`
was the same sentence twice and the second one is better. The mark stays, small,
because this is the one screen with no chrome of any other kind on it.

### 1.8i The agree button waits until the end, and says why


Settled 2026-09-21. **It is disabled until the document has been reached the end
of, and it explains itself while it waits**: `Read to the end first`, with a
down arrow, over a line saying how much is left. A progress rule runs along the
top edge of the footer bar, which doubles as the answer to "how much of this is
there" on a seven-thousand-pixel document.

A grey button that will not say why is the thing people tap three times and then
complain about, and on the one screen with no way around it that is an unkind
place to be silent.

**It also makes the consent real rather than procedural.** Nobody is asked to
agree to something they have not been shown, which is the only version of this
gate worth having given what it now covers.

Both states are `data-props` levers, `returning` and `read`, not controls. A
control on a mock is a feature somebody will ask about later.

**The timezone is collected here**, as the real gate does, because every window,
streak and fine is judged in it and a wrong one is wrong from the first day. The
button says what it is agreeing to: *"I am 18 or older, and I agree."*

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

**AND THE FIRST SCREEN CARRIES THE REFUSAL.** Added 2026-09-21. Under "Hello,
Ren" sits **"I do not want a coach"**, with one line: nothing of yours is sent
to a model, and you can switch him on later in Settings.

1.14 already says off is a real off. Offering it only in Settings would mean
the one person who does not want a coach has to accept one, go looking for the
switch, and turn it off, which is a worse version of the same answer.

**The whole tutorial branches on it.** No sphere on the picking screen, no
sphere at the end, the app's own voice instead of his, and the mark where his
face would have been. He is named exactly once more, on the last screen, to say
where the switch is. Nagging somebody about a thing they declined is how a
switch stops being a real switch.

The refusal sits UNDER the primary button rather than beside it. Side by side
makes two equal choices out of one obvious one and one honest escape.

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

**What the third one costs. THIS PARAGRAPH WAS WRONG AND THE CORRECTION IS
WORTH MORE THAN THE ORIGINAL.**

What it said: one activity carries two verdicts for a day, `activity_scores`
holds one row per user, type and period, so a second verdict needs **a second
scope on that table**, a second pass, and `verify` diffing both.

**The second scope was priced against a foreign key that was deleted in
`migrations/0012_group_model.sql:72`**, four years of migrations ago.
`src/db/schema/app.ts` never declared it and `scripts/break-in/direct.ts:251`
proves its absence by inserting outcomes with no matching scores. Corrected
2026-09-21 after three agents read the code rather than the plan.

It is worse than merely unnecessary. A discriminator in the primary key is a
**hostile migration**: the running version's upsert names three columns
(`scoring.ts:855`), Postgres rejects an `ON CONFLICT` with no matching
constraint, and `closeOutstanding` runs on every page read. Every screen would
throw for the length of the promote. It would also break about twelve read
sites silently, including one where a monk miss ends a real streak and one
where `verify` stops being a check without saying so.

**The real shape is one nullable boolean, `monk_passed`, on the existing row.**
Additive. Zero read sites break. A monk verdict cannot reach money because the
duplicate-outcome path needs a second row and there is not one, which is a proof
rather than a guard somebody has to remember. `verify` diffs it in four lines.
Reversible in one statement. `SCHEMA.md` 0035 has the whole argument.

**Two thirds of the price survives and is cheap.** The "second pass" is one more
call to a pure function with the check-ins already loaded. "Verify diffing both"
is four lines inside a loop that already runs. Only the second scope goes.

It still changes what Monk mode IS. Reading `passed` makes it a lens; applying
its own thresholds makes it a second opinion. The cheap version of the same
intent, which is **not** what was chosen and must not be reached for later, is
to let the member set a harder target on the activity itself: a member-set bar
breaks the comparability 1.29's share toggle rests on.

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

### 1.19 The yes/no activities are separate types, collapsed into one Home row

Settled 2026-09-21. Aman: *"we can have morning sunlight, no alcohol, no social
media, no junk food, cold shower, etc etc, but we don't need to make them all
individual activity as it will just overload user with activities in home page,
we need a way to combine them all which are just yes/no."*

**The overload is real and it is a HOME problem, so it is fixed on Home.** Each
condition stays a real activity type with its own window, its own streak, its
own sharing toggle and its own `passed`. Home draws them as ONE expandable row,
`Simple ones, 3 of 5`, which taps open.

Two alternatives were offered and refused. A single "Daily list" type with one
streak is cheapest, and it throws away per-item streaks and makes one slip fail
the lot. A composite that reports per item keeps the streaks and breaks
invariant 6, because the engine would have to read inside a module's `detail` to
know what an item means, which is the thing v3 spent a phase preventing.

**Each one stands alone.** Cold shower breaking has nothing to do with No
alcohol. Five verdicts, five streaks, five possible fines. That falls straight
out of them being five types, and it is the reason the grouping had to be
presentational.

**The list is ours plus yours.** Our conditions carry a category, so Monk mode
can require a body, a food, a mind and a sleep (1.16). A condition somebody
writes themselves has no category and counts toward nothing: nothing can know
whether "no doomscroll" is a MIND thing, and 1.16's requirements exist so the
number means the same for everybody. Two code paths, and the difference is said
out loud on the screen rather than hidden.

### 1.20 Ren thinks nightly, and again when asked

Settled 2026-09-21. **The nightly job writes his lines for the next day**, so
every screen that carries one is instant and there is never a spinner where a
sentence should be. **The Ask Ren box and the suggestion chips make a live
call.**

Three calls a day of fixed cost, plus whatever people actually ask, which is the
only part that scales with use. It also means a slow or dead provider degrades
to "you cannot ask him a question today" rather than "Home does not load", and
1.3 already guarantees no number depends on him.

The cost of it: his Home line can be up to a day stale. That is acceptable
because the line is about a pattern rather than about this morning, and anything
that has to be current is arithmetic and is not his.

### 1.20a How 1.19, 1.20 and 3.1 came back

Three entries were written on 2026-09-21 and silently truncated the same day by
a later append that rewrote everything from `## 3. Open` downward. Nothing
noticed, because every other file went on citing them by number and the numbers
still read as though they were there.

Recovered from commit `ec6bd71` and reassembled rather than retyped, which is
the only honest way to restore a decision record. This file is now written by
sorting and reassembling its blocks instead of appending to the end, so the
failure has no second chance.

**It is also the argument for M1.** A decision record that can lose a decision
without anything going red is exactly why the mechanically checkable ones need
`check:decided` and not a convention.

### 1.21 The model is swappable, and the seam is the point


Settled 2026-09-21. Aman: *"I want to use Gemini or DeepSeek, cheaper models,
easily switchable from code if I need. I want to keep my budget for AI tight."*

**One interface, `src/server/coach/provider.ts`, and the provider comes from the
environment.** `COACH_PROVIDER` and `COACH_MODEL`. Swapping is an env change and
a redeploy, never a code edit.

**Gemini Flash first, because the nightly pass has to see photographs.**
DeepSeek sits behind the same seam for Ask Ren, where the input is text over a
digest and the cheapest thing wins. That split is a consequence of 1.22 rather
than a preference: DeepSeek is text-only and the photo insight cannot run on it.

### 1.22 He is handed a digest, plus only the photographs the insight needs


Settled 2026-09-21. The server computes the facts, streaks, windows, misses, and
what the group shared, and hands him a small structured summary. Nothing leaks
that the digest did not include, and the digest is testable with no model in the
loop.

**Photographs go with it, and the digest names which ones.** This week's
dinners, not everything from the last seven days. Photographs are the most
expensive and the most invasive thing in v4, and a fixed cap would spend the
whole budget on ten pictures of water.

### 1.23 The coach is its own job, and its failure is visible


Settled 2026-09-21. **A fourth QStash schedule, `/api/cron/coach`**, not folded
into nightly. A slow provider must not be able to make the full replay, the
sweeps and `verify` run long.

It retries like everything else. **When the retries are exhausted and it lands
in the DLQ, Home shows no line at all** and offers a recompute. That button
exists only when a failure is recorded: `ops.job.failed`, or a missing line for
today. No failure, no button. The server decides and the client cannot ask.

A written fallback sentence was refused. It would be the same sentence every
time, which is worse than silence.

### 1.24 One hard rule on what he may say, and the rest is deliberately open


Settled 2026-09-21. **Every number in his lines comes from the digest,
verbatim.** He may place a number and never derive one. That is testable: a
digit in his output that is not in his input is a bug.

Health advice, predictions and remarks about other members were offered as
further bans and were kept open: *"for now less limits as its invite only so
its fine we can see how it evolves in future."* Three friends, and an admin who
can read what was sent. **This is a dated position, not a permanent one**, and
it is the first thing to revisit before anybody outside the three uses Curfew.

### 1.25 He keeps a rolling summary, and you can read, edit and clear it


Settled 2026-09-21. One paragraph per person, rewritten nightly, rather than the
turns kept verbatim. Cheap to send and it never grows.

**And it is yours to see.** One row in You: what Ren remembers, the paragraph as
plain text, with edit and clear. A model writing a description of you that you
are not allowed to read would be the indefensible part of this whole feature.

The cost, written down: an edited summary is something you wrote that he will
later treat as his own observation. That is accepted.

It is a new table, so it goes in the consent gate and in Delete data.

### 1.26 Ask Ren is capped per person per day, and the bill has a hard stop


Settled 2026-09-21. A daily cap per person on questions.

**And a spend ceiling.** Every model call writes an event, Ops shows calls and
estimated spend for the month, and above a number Aman sets **Ask Ren switches
itself off while the nightly lines carry on**. That kills the uncapped half and
keeps the half whose cost is three calls a day and already known. Admins are
told when it fires.

### 1.27 A nudge is only possible while the window is open, and that is the limit


Settled 2026-09-21, and it closes 1.5's open question without adding a rule.
At-risk is the only state a nudge can move, so the window itself is the rate
limit. No counter and no claim row.

**Delivered by push AND the card on Home.** Push is best-effort and permission
can be off; the card always lands. A badge on the tab was refused: a count for
something that is not your own day is the first step toward an inbox, and
`Nudged` was drawn specifically to avoid one.

### 1.28 Ren sees nudges and may mention them. THIS REVERSES PART OF 1.4a


Settled 2026-09-21, and it is a reversal, so it is written as one.

**1.4a says:** *"AND HE STANDS DOWN WHEN A PERSON SPEAKS. If Mira nudges you
about Water, Ren says nothing about Water. A human beat him to it, and two
voices about one thing is worse than either alone."*

**What was chosen instead:** he sees the nudge in his digest and may refer to
it. *"Mira noticed too."*

The argument against, from 1.4a, still stands and should be read before this
ships: it makes him a commentator on your friendships, which is a different
product from a coach who reads your record. The argument for is that a coach who
pretends not to have noticed the thing everybody noticed is a worse one.

**The half of 1.4a that survives is the one-line rule.** Whatever he says about
a nudge is his ONE line for that screen, never a second one on top of what he
was already going to say. If that is not held, this reversal becomes exactly the
two voices 1.4a warned about.

### 1.29 Monk mode is shareable, and the second verdict lives only inside it


Settled 2026-09-21, and it changes two things.

**The percentage has a share toggle, like any activity.** It is comparable
between members precisely because 1.16's requirements make it mean the same
thing for everybody, which was the point of them. Keeping it private like the
global score was offered and refused.

**The stricter monk bar IS built in v4**, and it costs about a tenth of what
1.16 wrote down. Deferring it and dropping it were both offered and refused, and
then the price itself turned out to be wrong: see the correction in 1.16. One
nullable boolean on the existing row, a second call to a pure function, four
lines in `verify`.

**Water, Screen and Sleep are the only modules with a bar.** Everything else in
a monk set contributes its own verdict, and still counts. A type with no bar is
never excluded from the denominator: if it were, adding Cold shower to a set
would silently shrink it and the number would measure three types while reading
as though it measured everything.

**And the second verdict appears nowhere but Monk mode's own screen.** Home, the
streak and the fine use your own target and never mention the monk bar. Two
contradictory verdicts on a Home row would break the one screen that has to be
readable in six seconds.

### 1.30 One tag, everything at once


Confirmed 2026-09-21, which is 1.7 unchanged after two easier routes were
offered. Not phased over two tags, and not with the coach dark behind the admin
switch. The three of them hit the consent gate, accept, and the whole of v4 is
there.

### 1.31 What this planning session settled, 2026-09-21


Written as one entry because none of it is big enough for its own, and all of it
blocks a phase.

| | |
|---|---|
| Compulsory in Monk mode | Sleep, No junk food, Screen, **Steps** |
| Modules with a `monkBar` | Water, Screen, Sleep, and nothing else |
| The four nudge messages | *Don't break it* / *You've got time* / *Mine's done* / *Come on* |
| `COACH_DAILY_ASKS` | 20 |
| `COACH_MONTHLY_CEILING` | 800 rupees |
| `.planning/v3/SCREENS-retired.md` | Retired. A v4 file lists all 41 boards. |

**"Walking" is Steps.** Aman named it among the compulsory four; Steps already
exists and is at-or-above a number, so nothing new is built. It covers BODY.

**The four messages do four different jobs**, which is the reason there are four
and not one: the streak, the window, the example, the shove. *Mine's done* is
the one that actually works on people. They live in code beside
`notification-copy.ts` and are stored by `message_key`, never as text, so they
go through review the way v3.3's bad release taught.

**Ren's prompt lives in `src/server/coach/prompt.ts`, with golden tests AND a
simulator.** Both, not either. The tests hold the mechanical half: no invented
digit, under the length limit, one line per surface, over forty seeds, which is
the exact shape of `notification-copy.test.ts` and the thing that caught
*"Almost there on Water. 0 of 8 today."* `bun run sim:coach` prints a week of
his lines with no database and no network, because the rules cannot catch a
sentence that is clear to whoever wrote it and to nobody else.

### 1.32 Four mechanisms, so the build cannot drift from this file


Settled 2026-09-21. Aman: *"make sure somehow we don't really drift from any
decisions and hence no extra effort."* All four were chosen; they catch
different things and none substitutes for another.

**M1. `bun run check:decided`, and it fails CI.** Every decision here that is
mechanically checkable gets an assertion, in the house shape of
`scripts/check-money.ts`. Among them: the five types are registered with
categories; no member-written condition has a category; **no `anthropic` or
`claude` string anywhere in `src/`**; the coach job is declared with its failure
callback; the cap and the ceiling come from the environment; `monkPassed`
appears in exactly five files; `CONSENT_VERSION` is 2. Plus `check:monk` and
`check:member`, which have their own lists in `PLAN.md`.

**M2. Every commit names its decision.** A phase commit cites the numbers it
implements and this file gains a **Built in** column. It is a convention and
holds only while somebody remembers, which is why M1 exists.

**M3. `.planning/v4/SCREENS.md`.** All 41 boards, one row each, ticked by a
person who opened the screen beside the board, in the same commit. **A phase
cannot close with an unticked row it touched.** v3's file was never ticked once,
which is the whole reason this one needs teeth. No screenshot tooling: a
reference capture is a capture of what was built, so it locks in drift rather
than preventing it.

**M4. A phase closes by re-reading its decisions.** Walk that phase's entries in
this file line by line against what was built and write down what differs, in
the closing commit. About an hour, and it catches interpretation drift that no
assertion can.

---

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

### 3.1 Which new activity types v4 adds. SETTLED 2026-09-21
Five, all of them held-or-slipped with no photograph, which is the Sugar-free
module's shape and needs nothing new from the engine:

| Type | Category |
|---|---|
| Cold shower | BODY |
| Morning sunlight | BODY |
| No junk food | FOOD |
| No alcohol | FOOD |
| No social media | MIND |

**No social media is not Screen.** Screen is total device time, and somebody can
be under two hours and have spent all of it scrolling. They are different
conditions and they were kept apart deliberately.

All five arrive under 1.19's single Home row, so adding five types adds one row.
The list can grow later without Home growing with it, which is the whole point
of that decision.

**This entry was lost once.** An append on 2026-09-21 truncated the file at
`## 3. Open` and rewrote everything below it, taking this with it. Restored the
same day. It is the reason the file is now assembled rather than appended to.

### 3.2 What gets built first. SETTLED 2026-09-21
**The engine first and the coach last.** Eight phases in `PLAN.md`.

The instinct is to answer the riskiest thing first, and it is wrong here: Ren
reads a digest built from outcomes, streaks and group shares (1.22), and 1.19
changes what an activity list even is. Building him first means building him
twice.

**The design is not a phase either.** v3 built screens against `SCREENS.md`
because the screens were new. Here the routes exist and the look changes, so the
redesign rides inside each phase. A phase that is only "make it look right" is
the phase that gets cut when time is short.

**And Phase 5 builds the whole coach against a STUB provider**, with the real
model arriving only in Phase 6. The gap is the point: otherwise every bug is the
prompt, the digest, the schedule or the provider, with no way to tell which. The
stub stays for ever, because no test should need a network.

### 3.3 The limits on what Ren may say
1.24 banned one thing and dated the rest. Revisit before anybody outside the
three uses Curfew.

### 3.4 The admin console is nine routes and v4 has drawn one
Raised 2026-09-21. Aman: *"we need to design full Admin tabs, we had around 6-8
tabs in admin for many things which are missing from v4 planning."*

He is right and it is my omission. 1.8 says, in as many words, *"`V3Admin*` was
seven boards and is one here, Ops, because the scheduler, drift and the controls
are what the console is actually read for."* That was a reasonable call for a
design review and a bad one for a build: **the routes exist and Phase 7 has to
render them all.**

**What is actually there**, nine routes and ten v3 artboards:

| Route | v3 board | v4 board |
|---|---|---|
| `/admin` | `V3AdminOverview` | none |
| `/admin/users` | `V3AdminUsers` | none |
| `/admin/users/[id]` | `V3AdminUserOne` | none |
| `/admin/groups` | `V3AdminGroups` | none |
| `/admin/groups/[id]` | `V3AdminGroupOne` | none |
| `/admin/insights` | `V3AdminInsights` | none |
| `/admin/reports` | `V3AdminReports` | none |
| `/admin/controls` | `V3AdminControls`, `V3AdminControlsConfirm` | none |
| `/admin/ops` | `V3AdminOps` | `Admin` |

**And v4 gives every one of them something new to show**, which is why this
cannot be "restyle the v3 boards":

- **Controls** gains the Ren and Nudges switches, which 1.14 and 1.13 require
  to be real kill switches, and 1.26's hard stop is a state it has to render.
- **Users** gains whether somebody has a coach, what their cap is, and what
  they have spent.
- **Reports** is the moderation queue, and a photograph read by a model is a
  new thing to report.
- **Insights** gains Monk mode and the coach's bill.
- **Ops** already has the fourth job and the spend, which is the one piece that
  is drawn.

**Not decided:** whether this is a Phase 7 slice, a phase of its own, or work
that follows v4. It is eight boards and eight routes, so it is not small.

### 3.5 A simplification round, and it will reopen settled decisions
Raised 2026-09-21. Aman: *"we have to do a round with simplifying some of the
things like sharing with group, group onboarding, etc more. Mainly this round
will affect a lot of designs and our decisions but its aim will be to simplify
the UI and UX in such a way that it's very easy to use Curfew app without any
confusions."*

**This is the only item in this file allowed to overturn things in section 1**,
and it is written here so that when it does, it does so deliberately and with
the original reasoning to argue against.

**Named so far:**

- **Sharing with a group.** Today it is two switches per activity per group:
  one for the fact, one for the photograph (1.2, and the consent gate turns on
  it). With three groups and seventeen types that is a lot of switches, and
  `Sharing` is the board that shows how many.
- **Group onboarding.** The invite, choosing what to share, and an untracked
  type offering setup, which is three decisions before somebody has seen the
  group.

**Where it will collide**, so nobody is surprised:

- **1.2 and 1.18** — the photograph switch is the mechanism by which sharing a
  picture consents to a coach reading it. Simplify the switch and that sentence
  has to be rewritten, on the one screen nobody may mislead.
- **1.19** — the grouped Home row is already a simplification of exactly this
  kind, and it is the model: **the overload was a Home problem and it was fixed
  on Home, without touching the engine.** A simplification that changes what is
  stored is a different and much more expensive thing than one that changes
  what is drawn.
- **1.16** — Monk mode's requirements exist so the number means the same for
  everybody. Simplifying them makes it comparable to nobody.
- **The 41 boards.** Most of them are a switch or a list, so most of them are
  in scope.

**When.** Not inside a build phase: a round whose aim is to change what the
screens are cannot run at the same time as the phases that build them. Either
before Phase 1 or after Phase 8, and that is itself undecided.

**One thing to hold on to when it runs.** Every switch in this app was argued
for once, and the argument is in this file. Simplifying is removing a choice
somebody decided was worth offering, so the round's job is to find the ones
where that decision was wrong, not to remove choices because there are many.
