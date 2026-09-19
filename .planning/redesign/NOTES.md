# The redesign, while it is still an argument

**Nothing here is decided.** This is the running record of a conversation, kept
so it is not re-derived from scratch next week. When something IS decided it
leaves this file and becomes a scope file with a number, the way
`.planning/v3.3/SCOPE.md` did, and the ROADMAP rule applies: name the settled
decision being overturned before overturning it.

Started 2026-09-17, the day v3.4.0 shipped.

---

## What started it

Testers, three people who are all developers, reported roughly this:

- not intuitive
- important things are buried in Settings
- it does not motivate anybody to use it
- the group page is confusing to read
- a lot of text, and it reads like an AI wrote it

Aman's reading, which is the one this file works from: **this is not a list of
fixes. The substrate is right and the surface is wrong.** What to track, how to
track it, and groups as the accountability layer are all solved. What is missing
is everything that makes somebody want to open it.

So: full UI redesign, and the theme turned upside down.

---

## What is settled, and worth protecting

Do not relitigate these while redesigning around them.

- **The tracking model works.** Twelve activity types, per-user schedules and
  thresholds, the module interface, periods and windows. Nobody complained
  about what it tracks or how.
- **Groups are the right accountability layer.** Private, invite-only, sharing
  opt-in per activity.
- **Money stays.** Aman, explicitly. It is the most distinctive thing Curfew
  has.
- **Photo evidence is the unexploited asset.** It already exists, it is already
  per-check-in, and it currently does no emotional work at all: it is stored,
  scored and never seen by a human in a way that feels like anything.
- **The visual language is not the problem.** IBM Plex Mono, zero radius, no
  gradients, no emoji, colour never the only carrier of meaning. That is a real
  point of view and the opposite of generic. The COPY is what reads as slop,
  not the design. See "Theme" below for where this is being revisited anyway.

---

## The central asymmetry, which shapes everything

**Duolingo's loop happens inside the app. Curfew's happens outside it.**

Open Duolingo and the app IS the activity: effort, feedback and reward all land
inside three minutes. That is why celebration works there. It is rewarding
something it just watched you do.

Curfew never witnesses anything. You went to the gym; the app saw a button
press. So copying Duolingo's reward mechanics directly would reward THE PRESS
rather than the work, which is how a tracker turns into a thing people tap to
keep a streak alive while quietly not doing the activity. That is worse than a
boring app, because it destroys the only thing the data was for.

**Therefore the closer references are BeReal and Strava, not Duolingo.**

- **Strava** is a ledger of effort that happened outside it, and it is fiercely
  motivating with no points animation anywhere. The reward is kudos from people
  who know you, plus competition with your own past self.
- **BeReal** is an unfakeable photo, on a deadline, shared with a small group.

Curfew already has both primitives and uses neither for feeling. Photo evidence
plus small private groups is arguably a stronger hand than Duolingo's.

Duolingo is still worth studying properly (open question 3) for the mechanics
that transfer: streak psychology, loss aversion, the morning prompt, and how a
notification earns a tap.

---

## The reframe on the table

**Let the group be the enforcer and make the app your ally against it.**

Today the app is the enforcer. `CLAUDE.md` says "Curfew is a clerk, not a coach.
It states facts and consequences." The complaint "it does not motivate me" is
that instruction working as written.

The tension is real: the app is called Curfew, its premise is consequences, and
Duolingo's premise is encouragement. An app trying to be both usually ends up
incoherent.

The resolution: the fine comes from your friends, and the app is the thing
helping you avoid it. Then warmth is not a contradiction, it is the correct
voice for an ally.

> "Gym closes in 25 minutes and Rahul has already been" is your ally.
> "Window closes 7:45 AM. Miss it and today does not count" is the bailiff.

**There is already a proof of this.** v3.4.0 carved push notifications out of
the clerk rule. Same engine, same data, the only change was permission to speak
like a person:

```
before   Almost there on Water
         0 of 8 today. Closes at 11:59 PM. Food, Supplements and Reading
         and 5 more are open too.

after    Last call for Water
         8 glasses to go. Log it now!
```

ROADMAP theme 3 asks whether the rest of the app follows. The testers have
answered it.

---

## What BeReal actually does, and which parts transfer

Aman named BeReal as the design he likes. This is the mechanic-by-mechanic
version, because "make it like BeReal" is not actionable and the ranking matters
more than the list.

### 1. The reciprocity gate. The best one, and it fits perfectly.

**You cannot see anyone else's post until you have posted yours.**

For Curfew: you cannot open the group gallery today until you have logged today.

This is the highest-value idea in this file. It converts check-in from a chore
into the key that unlocks the social reward, it cannot be gamed because the
thing being unlocked is other people rather than a number, and it is native to
an accountability app in a way that confetti never will be. It also solves the
"why would I open this" problem without inventing a currency.

Open: does it gate the whole group tab or only the gallery, and what does a
member on a declared pause see.

### 2. RealMojis rather than likes.

Reactions are a photo of your own face pulling the expression, not a heart. More
effortful, warmer, and still nowhere near approval. This is the shape of the
"interactions, we can have something" Aman asked for.

### 3. The late badge.

BeReal publicly stamps "2 min late" on a post. Curfew already knows exactly when
a press landed relative to its window closing, so "logged 4 minutes before
close" is computable today. Public, gentle, and carries no fine.

### 4. Memories.

Your own past as a calendar of photographs, private, no other people involved.
Curfew holds every photo and every date already and `/stats` currently answers
with charts. This is the reward that still works when a group goes quiet, which
matters at three users.

### 5. Photo-forward, chrome recedes.

**This is the actual "theme turned upside down".** Today Curfew is text with
photographs attached as evidence. BeReal is a photograph with almost no
interface on it. Inverting that would answer most of the "too much text"
complaint without rewriting a single sentence.

### What does not transfer

BeReal's single random daily prompt. Curfew's per-activity scheduled windows are
already a better version of that deadline, and they are the product.

---

## The social layer (Aman's proposal)

The direction: **social media with activity attached**, so the dopamine comes
from people rather than from the app's own arithmetic.

- **A gallery in each group.** Members' evidence photos, browsable.
- **Reactions.** DECIDED: interactions only, never approval. See the hazard
  below, which Aman agreed with.
- **Retention limits removed**, so the gallery is a history rather than a
  rolling 60-day window.

### Photos per check-in: already built, already nearly right

Clarified by Aman: the rule is **a photo on every check-in, at the step in that
activity's lifecycle where a photo means something.** Food photographs every
meal. Sleep does not photograph you sleeping, it photographs the confirm window.

**This is not an architecture change. It already exists.** `EvidenceRule` in
`src/domain/types.ts` carries `level`, `source` and an optional
`steps?: string[]`, and the modules already declare it per step:

```
sleep   required, steps: ["confirm"]   "On the confirm window. Live camera."
food    required                        every check-in
gym     required                        "Live camera, on every session."
supplements, study   required
reading, steps, screen   optional
water   none                            "Nothing to photograph. This runs on your word."
```

So sleep is ALREADY exactly what Aman described. What is actually open is
narrower than it looked:

- Do `reading`, `steps` and `screen` move from optional to required?
- Does `water` stay at none? Eight glasses a day is eight photographs, which is
  the highest-friction case in the app and the one most likely to make somebody
  stop using it. Its current line, "Nothing to photograph. This runs on your
  word", may simply be right.
- `steps` and `screen` are `source: "gallery"`, not live camera. A gallery photo
  in a social feed is a different trust proposition from a live one.

### Hazards found so far

**Approval must not gate scoring. DECIDED: no approval at all, interactions
only.** Recorded with the reasoning because it will come back: if somebody else
approving your photo decides whether the activity counted, their inattention
costs you money and a streak. A friend goes quiet for a weekend and a 40 day run
dies. Likes, reactions and comments are pure upside; approval is a veto with a
fine behind it. `CLAUDE.md` already defers the adjacent feature for close to
this reason: "Objections, meaning flagging a shared log as false. Deferred to
the release after v3, and flag-only when it lands."

**Removing retention breaks a promise already acknowledged.** The consent gate
says, verbatim, that photos are "Stored in object storage outside this app, and
deleted 60 days after they are taken" (`src/server/consent.ts:43`,
`RETENTION_DAYS = 60` in `src/server/evidence.ts`). Every account consented to
that exact sentence. Keeping photos indefinitely needs a fresh consent round,
not a constant change. Also worth pricing: R2 storage stops being bounded and
starts growing forever, and `Photo retention` is a row in Settings today.

**A gallery is a new read path over other people's photos.** v3.1 shipped two
bugs of exactly this shape in opposite directions: a group saw a member's whole
back catalogue on joining, and shared evidence never reached the group at all.
Whatever the gallery does, it reads through the existing sharing path
(`assertMember`, then `sharesFor`), and `check:evidence` grows a case.

---

## Open questions

### 1. What is the one number? Streaks, reputation, or XP?

**DECIDED: per-activity streaks stay. XP is out.** Still open is what the one
headline number is.

**Why XP is out.** XP rewards volume, and Duolingo wants volume because more
lessons genuinely means more learning. Curfew's activities are CAPPED by design:
8 glasses, 3 meals, 2 doses. You cannot grind. So XP would land on almost the
same number every complete day, which makes it a worse streak wearing a game's
clothes. XP fits unbounded effort. Curfew's effort is bounded on purpose.

**What the shape of the problem actually is.** Duolingo's streak works because
there is exactly ONE thing to protect. Curfew splits it nine ways, so there is
no single thing to lose and "4 streaks going, 2 broken" is accounting rather
than a feeling.

Three candidates for the headline, not mutually exclusive but three numbers is
certainly too many:

| Candidate | What it does well | What it does badly |
|---|---|---|
| One overall streak | One thing to protect, loss aversion works | Hides which activity broke; one bad day wipes everything |
| Reputation, made weekly | Already built, already has six ranks | Currently a slow static ladder, not a race |
| XP | Familiar, always goes up | Rewards volume Curfew deliberately caps |

**Unresolved and important:** reputation today is 0 to 1000 and permanent
status. Leagues are a WEEK with promotion and relegation. Time-boxed with
stakes is what makes people check on a Sunday night. Whether reputation becomes
that, or sits behind something that is, is open.

Also noted: the score currently has no referent. "You are 847, SOVEREIGN here"
does not say out of what, whether that is good, or whether it moved.

### 2. How do groups work in the new design?

Flagged by Aman as needing real thought, not yet had. Inputs: the gallery, where
reactions live, whether there is a weekly race and whether it is inside a group
or across them, and how the four hub tabs collapse. The current hub is one of
the three screens testers named as confusing.

### 3. Understand Duolingo properly

Not "add streaks", actually understand the retention machine: the streak and
freeze, the daily goal, leagues with promotion and relegation, the path with an
always-obvious next step, loss-aversion notification copy, and the widget. Then
decide mechanic by mechanic which survive the inside/outside asymmetry above.

Worth the same treatment for BeReal and Strava, which are the closer analogues.
`.planning/research/` is where this goes.

### 4. Money

**Decided: money stays.** Open: whether the app's voice changes given the
reframe above, and whether the fine becomes something the app helps you dodge
rather than something it announces.

### 5. The morning, and the empty state

Aman: show people in the morning what they have to do today, personalised.

Today, opening the app having done nothing shows a chore list. Duolingo shows a
path with an obvious next step. This is the single most-visited screen and the
one with the least design intent behind it.

Note the overlap with v3.4.0: `sweep` and the morning cues already decide "what
is worth saying to this person right now". A morning briefing screen is the same
question asked of a screen rather than a notification, and the logic should not
be written twice (`src/server/notification-kinds.ts` is where it lives now).

---

## SETTLED on 2026-09-17, from four passes at the Home mock

The mocks live at https://claude.ai/artifact/U6x8pi4khQX5qxBSGEiHyi

**Platform: iOS first.** Android gets a competent version of the same thing.

**Feel: BeReal.** Not Duolingo, not Strava, not Oura.

**Colour: accent only.** True black ground, iOS dark surfaces (`#1c1c1e`),
0.5px hairlines. ONE accent, pink. On Home it appears three times: the capture
button, the active tab, a live streak flame. **The photographs carry all the
colour.** That is the resolution of "accent only" against "dopamine rich", and
it is exactly how BeReal gets away with a near-black interface that still feels
alive.

**Type: the system font stack**, `-apple-system, BlinkMacSystemFont`. On an
iPhone this renders real SF Pro. No web font can fake that, and it is the single
biggest native tell. iOS type scale: 34px large title, 20px section, 17px body,
15px secondary, 13px footnote.

**Lists are iOS grouped insets**, one container with separators inset from the
text. NOT a floating rounded card per row with a gap between. That row-as-card
rhythm was the loudest "web dashboard" tell in two earlier passes and no amount
of repainting fixed it.

**No gradients on chrome.** Not one.

### Home's structure, decided

1. **The day count.** `4 of 8 today`, with eight segments filling. This is
   `Today.done / Today.of`, which is the real headline number Curfew has.
2. **The coach**, which is the most urgent ACTIVITY promoted in place, carrying
   its own streak, the peer fact and the camera. Not a separate card above a
   list.
3. **The activity rows**, each with ITS OWN streak flame.
4. **The friends feed**, across all groups, with the group named on each entry
   and a streak badge on the photograph.

### The mistake worth not repeating

Four passes were spent designing against assumptions instead of the code. The
worst was **a single account-level streak at the top of every mock. Curfew has
no such thing.** `TodayRow.streak` is per activity, from `standingsFor`. Related
things missed the same way:

- `done`/`of` is the real one number, and `SCREENS.md` already specifies the
  segmented bar that fills.
- Every activity type already declares an `icon`. Letter tiles were invented to
  replace something that existed.
- **Grace and Restore were never drawn at all**, through four passes. A broken
  streak is a grey flame plus a Restore beside the control, never replacing it,
  and `SCREENS.md` records that this row took five drafts.
- The day completing lands a **stamp** with a motion spec. Already designed,
  never mocked.

Read `src/server/today.ts` and `.planning/v3/SCREENS.md` before drawing
anything else.

### Still open after this round

- **The day-complete stamp.** Probably the biggest dopamine beat in the product
  and it has no artboard.
- **Money.** Not in any mock. Undecided whether it leads or recedes.
- **The reciprocity gate.** Still the strongest single idea in this file, still
  not placed.
- **Track and Group** have not been redone in this language yet.

### Ember now contradicts the mocks

`https://claude.ai/artifact/EegrmSkMHUjv9UxhPMw7Hn` was built before the iOS and
BeReal calls and is out of date in three specific ways:

- It mandates **monospace for every number**. The mocks use the system stack
  throughout. The mono rule was invented, is not in any reference, and fought
  the feel. It should go.
- It defines **brand gradients** and a `glow-ember` shadow. The mocks use flat
  fills and no gradients on chrome.
- Its ground is **plum-black** `#0d0709`. The mocks are true black, because a
  warm ground read as more pink on top of an already pink-heavy screen.

Either update Ember to match, or say plainly that Ember was the exploration and
the mocks are the system. Do not leave both standing.

---

## Theme

**Not all black.** Aman wants colour and something that feels enjoyable.

References: **BeReal** (broken down mechanic by mechanic above), and
https://dribbble.com/shots/26162392-Language-Learning-App

### The dribbble shot, examined

Screenshots supplied 2026-09-17. What it is:

- **Near-black background with ONE accent hue.** A hot coral-pink ramp, used
  flat and as a gradient. A single green for "correct". Nothing else.
- **Rounded geometric sans**, bold for headings. Card radii around 16 to 20px,
  pill buttons.
- **A 3D mascot** (a small robot) and 3D rendered props as quiz answers.
- Bottom tab bar, five tabs, icon plus label: Home, Lessons, AI Talk, Rank,
  Profile.

**The most important observation: it is not a colourful app.** It is dark and
close to monochrome with one confident accent. Curfew is already near-black with
an accent, so the distance is smaller than "we need a theme" suggests. What is
missing is warmth, hierarchy, and using the accent with confidence rather than
sparingly.

**Home screen structure, which is the part worth copying:**

1. Avatar, date, "Hi, Rama!", notification bell with a count
2. **Streak card**: a big 12 with a flame, "12 Days streak, You're on fire!",
   and a Mon-to-Sun strip of circles, filled for done, flame for today, empty
   ahead
3. **One bright CTA card**: mascot, title, Start button
4. **Weekly Mission**: "23 Hours Left", a progress bar with locked milestone
   nodes, 10/25
5. A list of lessons
6. Tab bar

### What to take from it, ranked

**1. The week strip.** Seven circles, done or not, flame on today. Curfew
already holds this data. It is the fix for "847 has no referent": a number with
a picture underneath it showing the SHAPE of the run, not just its size.

**2. "Weekly Mission, 23 Hours Left."** A time-boxed goal with a visible
countdown and locked milestones. This is the weekly race argued for in open
question 1, drawn.

**3. Hearts.** Curfew already has this mechanic and calls it GRACE. It is
currently a number in Settings. Drawn as hearts on the home screen it becomes a
game piece rather than an accounting line, at almost no cost. **Caution:
Duolingo's hearts LOCK YOU OUT. Curfew's grace SAVES A STREAK.** Keep it a
shield, never a gate, or the app starts punishing people for opening it.

**4. Exactly one primary CTA.** Their home screen has one bright button. Curfew's
home is N activity rows with N identical buttons and no hierarchy, which is a
large part of "not intuitive": nothing says what to do first. Urgency is already
computed for notifications (`src/server/notification-kinds.ts` ranks by
`minutesLeft`), so the same ranking could choose a hero action.

**5. Almost no prose.** Count the sentences in that shot. Everything is a
number, a label or a control. The one full sentence, "Every day counts!", is
doing emotional work rather than explaining a rule. That is the whole
"too much text" complaint, answered by an example.

### What NOT to take from it

**The mascot and the 3D props.** Expensive to produce, and they would compete
with the thing Curfew has that this app does not: real photographs of real food
and real gyms. **Curfew's illustration should be its users' own evidence.** Free,
unfakeable, and more interesting than a rendered bicycle.

### The real fork: type

That shot's friendliness comes substantially from a rounded geometric face and
generous radii. Adopting both wholesale trades away the one part of Curfew that
does not look like every other app.

**Proposal to argue about, not decided:** keep a mono for NUMBERS AND DATA, where
it reads as precise and deliberate, and bring in a warm sans for VOICE. Severe
about facts, warm about people. That also happens to match the split v3.4.0
already made in the copy, where the module writes the numbers and the
notification writes the encouragement.

**It should feel native, not like a website.** Concretely, most of this is
reachable in a PWA:

- instant optimistic response on tap, no spinners
- haptics on every meaningful press (`src/app/haptics.ts` exists and is
  underused)
- bottom sheets rather than centred dialogs
- skeletons rather than loading states
- page transitions, and no browser scroll-bounce artefacts
- it is already installable, with splash screens per device

Not reachable without a native app: Time Sensitive notifications that pierce a
Focus mode, true system gestures, widgets. Those are ROADMAP theme 4 and
`.planning/research/native-app/FINDINGS.md`, which also records that Capacitor
is blocked today by Google refusing OAuth in embedded WebViews.

**What this collides with.** `CLAUDE.md`'s "Visual tells to avoid" currently
bans purple and indigo gradients, glassmorphism, glow, rounded corners with drop
shadows, pill buttons, and colour as the only carrier of meaning. The reference
shot uses a gradient, a glow and pill buttons. A redesign may overturn any of
those, but by the ROADMAP rule it says so first rather than drifting.

Worth separating when that argument happens: the ban was written against the
DEFAULT AI look, which is specifically purple and indigo gradients on white
cards. A hot coral on warm black is not that cliché, and the rule may have been
aiming at something narrower than its own wording.

**Colour as the only carrier of meaning stays banned regardless.** That one is
accessibility, not taste, and the reference shot obeys it too: its correct and
wrong states carry an icon as well as a border colour.

**One specific thing to be careful with.** IMMACULATE, the top rank, carries a
gold halo, and it is deliberately "the only glow in the app, which is what makes
it mean anything". Adding colour and light everywhere spends that for free. If
the app gets warmer, the top rank needs a new way to be special.

---

## Sequencing, when it starts

Not a plan, just the one ordering risk worth recording: **the problems named so
far are mostly structural, not visual.** Nine streaks instead of one, no
headline number with a referent, a status ladder instead of a race, nothing
happening on press, and the clerk voice. Every one of those survives a
beautiful redraw. Decide the mechanics first or the result is a prettier ledger.
