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

Not blockers. Things a scope file will have to answer, written down so that they
are not answered by accident instead.

Items that have left this list: the record's register (1.11), whether theme 1
comes first (1.12), what a nudge can be refused with (1.13) and Ren's off
switch (1.14). The three canvas review items were fixed on 2026-09-21 rather
than decided, so they are gone too.

### 3.1 What happens to the clerk copy shipped this week

3.4.3 and 3.4.4 shipped grey-streak strings in pure clerk. *"This week can no
longer be made."* Under 1.11 that sentence is a status line rather than a
number, so it is warm-register work and gets rewritten. Fine, but nobody should
be surprised by it.

### 3.2 Which model, where it runs, and who pays

Not chosen. Vercel Hobby allows 300s per function, so duration is not the
constraint. Cost is, and there is no mechanism in the product to recover it.

### 3.3 The dopamine detox activity

`DIRECTION.md` §6 has it fully argued: a reduction target rather than an
abstinence vow, on a 619-person trial where cutting an hour a day worked about
as well as giving it up. Nothing has been said about whether it is in v4.

### 3.4 The three review items the canvas notes still carry

From the v5 canvas notes, unresolved there: the heatmap on Your record is eight
weeks under a headline about one month and nothing says so; the ceiling tick on
Standing is a single pixel and reads as dust; and the group subtitle needs to
say it lists what YOU share, since no query returns a group's activities.
