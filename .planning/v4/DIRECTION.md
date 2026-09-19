# DIRECTION.md — what I think v4 should be

ROADMAP theme 3, the proposal. Written 2026-09-19, from the evidence in
`RESEARCH.md` beside this file. Nothing here is decided. Every section ends with
what it overturns, because ROADMAP's closing rule requires a theme to name the
settled decision it replaces before it replaces it.

---

## 1. The thesis, in one paragraph

Curfew's premise is already the rare one: a photograph inside a window you chose,
seen by four people who chose you. Almost every habit app is a checkbox with a
number beside it, and almost every social app is strangers. What Curfew has built
is the hard part, and what it has not built is any reason to feel something when
it works. **v4 adds the feeling and keeps the evidence.** The app stops being a
form you fill in and becomes a place where your day is happening alongside three
other people's.

One correction to the brief, and then I will build to the brief. The target is
not time-on-app. The apps that retain best win on **fast check-in and visible
progress**, and Curfew's next activity type is a dopamine detox, which an
attention trap cannot host honestly. The goal is **return often, leave fast**.
Everything below optimises frequency and completion, and treats a long session as
a bug. That is a more compulsive product, not a weaker one: the hit lands when
the day closes, not when the feed scrolls.

---

## 2. The voice: three registers, assigned by surface

The clerk-versus-coach argument has a real answer in the evidence, and it is not
a compromise. Self-determination theory says rewards support intrinsic motivation
when they are **informational** and damage it when they are **controlling**. The
clerk's register is the informational register. That is why it exists and it is
why it should survive.

So the change is not "make Curfew friendlier everywhere". It is that warmth gets
its own surfaces, and the facts stay where they are.

| Register | Where it speaks | Rule |
|---|---|---|
| **The record** | Numbers, times, money, the ledger, standing, history, any figure | Clerk. Unchanged. Never an adjective. This is the app's credibility and it is not for sale. |
| **The moment** | A press landing, a day closing, a comeback, a milestone, the feed | Warm. Short. Present tense. Second person. It may celebrate. It may never count. |
| **Speaking first** | Push, the weekly review, the coach | Already warm, already shipped, stays. Peer names, stakes, urgency. |

**The structural rule, lifted from `notification-copy.ts` and generalised: a
writer in the warm register never receives the numbers.** That file learned this
the expensive way, when a bank chose "Almost there" because the hint string was
non-empty and told somebody with zero of eight glasses they were nearly done. The
fix was not better copy, it was denying the writer the ability to make the claim.
Apply the same shape everywhere warmth is allowed: the fact is computed and
passed in as an opaque string, and the warm sentence may place it and nothing
else.

Concretely: "Nice. Water's in." is legal. "Almost there on Water" is not, and
cannot be written, because the writer has no count.

**Overturns:** CLAUDE.md Voice, *"Curfew is a clerk, not a coach... no
congratulation, no encouragement, no exclamation marks"*, for two of three
surfaces. The reason that rule was written, that a coach's voice makes claims a
clerk would not, is answered structurally rather than by restraint.

---

## 3. The design system: Ember, which already existed

The mocks of the last two rounds both went hunting for a palette twice over.
The shipped app was already wearing a warm one, `globals.css` with its
`#0b0a09` ground and `#ff7a2f` flame, and the account was already holding a
whole design system drawn for this product. Both rounds replaced them with cold
iOS grey and system pink, which is the generic thing, and both sources were
sitting in reach the entire time.

**v4 invents nothing.** It uses Ember, adds two rules, and settles the radius.

### Ember is the system, and it was already right

Corrected after reading it. This section first proposed IBM Plex Sans and a
14px radius, built up from the shipped `globals.css` tokens. Then I read the
Ember design system on the account, which the last round retired, and it
answers the same brief better:

> A dark, warm, encouraging system for an app that asks people to do something
> today and tells them how it went. The brief was one line: the app should read
> as an ally, not a bailiff.

That is this brief, written before it. Its brand pink `#ff3d68` is within a hair
of the `#ff375f` in the mock that was liked, which is the strongest evidence
available that the taste and the system already agree. It was retired on the
grounds that it clashed with a cold monochrome direction that has now been
rejected, so the retirement goes with it.

**v4 uses Ember unchanged and adds two rules.** Ground `#0d0709` plum-black,
`ember-500 #ff3d68` for the one primary action per screen, `flame-500 #ff6b35`
for streaks and only streaks, `gold #ffd23f` for one rank and nothing else,
`pass`, `warn`, `penalty`. Outfit for voice, IBM Plex Mono for every digit,
which keeps the house identity where it was load-bearing.

### What v4 adds to it

**Rule 5: people arrive as photographs, not as a hue.** The feed needed a way to
separate your state from other people's, and the obvious move was a second,
cooler temperature. Ember is warm throughout by design, every grey carrying a
little red, and a blue would have broken it. So other people are carried by
faces and full-bleed photographs instead, your own state keeps the colour, and
one glance at Home still says what is yours. No new token.

**Rule 6: warmth never gets the numbers.** Section 2's structural rule, written
into the system rather than left as a habit.

### Contrast, measured rather than assumed

Ember's own figures, confirmed: text-primary 15.8:1 on ground, text-secondary
7.5:1, text-muted 4.6:1 at the floor, ember-400 6.9:1, flame-400 8.4:1.

The one it settles: **the primary button is near-black on pink, never white.**
`on-ember` on `ember-500` is 6.1:1; white on the same pink is 3.4:1 and fails.
Ember's README calls this identity rather than compromise, and it is right: it
looks sharper than the white-on-pink every competitor ships.

### Radius: one value, and it is 16px

Decided. One token, not a scale, which was the substance of the call. Snapped to
Ember's own `radius-lg` rather than the 14px first proposed, so the mocks and the
design system agree on a number instead of being two pixels apart for no reason.

Round is reserved for two things, a face and a camera lens. A photograph is
**zero** and goes full bleed, which is the one square-edged thing in the app and
the strongest single signal that this is an app rather than a web page.

**Overturns:** CLAUDE.md Visual tells, *"Pill buttons. Zero border radius is the
house style."* Pill buttons stay banned. Zero becomes 16.

Also overturns `.planning/redesign/SYSTEM.md`, which retired Ember. That file
describes the rejected direction and should be deleted or marked superseded.

### Motion, which is where the dopamine actually is

Nothing in Curfew moves today, and motion is the cheapest reward channel there
is. Three primitives, nothing else:

1. **The fill.** A ring or bar completing when a press lands. 400ms, ease-out.
2. **The roll.** A number counting up to its new value. Tabular mono makes this
   free. 300ms.
3. **The land.** The stamp arriving when a day closes. One spring, one settle.

Everything else is instant. Motion is reserved for a state that actually changed,
which makes it mean something, the same argument that reserves the gold halo.

---

## 4. The features, by the five moments of a day

### Moment 1, before: the plan

When you configure an activity you set a **when**. Implementation intentions are
the best-evidenced cheap intervention in the literature and they need a **when,
where and after-what**. Curfew stores a third of one.

Add two fields to the configure screen that already exists:

- *After I...* (the cue: "brush my teeth", "get off the bus")
- *...at/in* (the place: "the kitchen")

That produces a sentence the app can say back on the row and in a reminder:
*"After you brush your teeth, in the kitchen."* Cheap to build, stored as config
through the existing insert-only future-dated path, and it is the highest
evidence-to-effort item on this page.

Optional second half: **mental contrasting.** One more field, asked once, at the
moment somebody adds an activity: *"What usually stops you?"* The evidence for
MCII over plain if-then is real, and the answer is also the best possible input
to the coach later.

### Moment 2, before: the nudge

The brief's "friend's push", built as its own object.

On a group, an open activity of a teammate is tappable. Tapping it sends them one
push: *"Anya nudged you. Gym closes at 8:00 PM."* One nudge per person per
activity per day, subject to quiet hours like everything else.

Why this and not a comment: peer support carries a 59% effect size on adherence,
and reciprocal accountability beats one-way visibility. A nudge is the cheapest
possible reciprocal act, and it is the one thing in the app that is unambiguously
somebody choosing to spend attention on you.

### Moment 3, the press: make it fast, because this is the real lever

The most uncomfortable finding in the research is that the apps with the best
30-day retention win on **fast check-in**, and that gamification does not predict
use. Curfew's check-in is: open app, find row, open live camera, shoot, wait for
an upload.

This is the work item with the largest expected effect in v4 and it is not a
feature, it is a budget.

- **Target: six seconds** from intent to done, measured from app open or
  notification tap to the press being recorded.
- Home opens on **the next open activity**, not on a list to scan.
- A reminder carries a **notification action** that goes straight to the camera
  for that activity. One tap from the lock screen.
- The camera is warm before the screen finishes drawing.
- Compression and upload happen **after** the press is recorded and the UI has
  already moved on. The press is the event; the photograph catches up. The
  architecture already separates these, so this is a UI change more than a
  server one.
- A non-photo type (water, supplements, an abstinence answer) is **one tap with
  no navigation at all**, from Home and from the feed.

If v4 shipped nothing else, this would be the part that mattered.

### Moment 4, after: the feed, and the moment

**The feed on Home**, as asked for. Cross-group, chronological, photograph-first,
full bleed. It is the mechanism that turns the group from a place you visit into
something that happens to you, and relatedness is one of the three needs SDT says
motivation runs on.

Three rules that keep it from becoming the thing we said we would not build:

1. **It ends.** Today only. When you reach the bottom it says you are caught up
   and stops. A finite feed is the whole difference between this and a timeline.
2. **It is people you chose.** No discovery, no suggestions, no strangers, ever.
3. **It is cool-coloured.** Other people's activity never wears your ember, so a
   glance at Home still tells you what *you* have left.

Reactions stay, and they should be cheap and warm. One tap, a small set, shown as
faces rather than counts.

**The moment** is the other half. When a press lands, something happens: the ring
fills, the count rolls, one short warm line. When the last activity of the day
lands, the stamp. These are the only animated things in the app and they are the
reward loop.

### Moment 5, the miss: the comeback

**This is the most important screen in v4 and the one currently least designed.**

Two independent literatures agree that the morning after a miss is where users
are lost. The abstinence violation effect says people with the longest runs are
the *most* likely to quit after one bad day, because a lapse reads as a verdict
on the whole project. Finch's reputation in ADHD and anxiety communities rests
almost entirely on not doing this.

Curfew's current Restore sheet says: *"Only the streak comes back. Your fine and
your standing in every group are untouched, and yesterday stays missed."* Every
clause is true and the sequence is the shame script, delivered at peak quit risk.

Rebuild it as **the Comeback**, under five rules:

1. **Lead with what is still true.** "Water is at 31. Today is still open." The
   thing you lost is not the headline.
2. **Never draw the lost number larger than the next one.**
3. **One action, and make it small.** "Start again" rather than "Spend 2 grace".
   Grace becomes the mechanism underneath, not the offer on the front.
4. **Say the base rate, once.** Most runs end. A person who thinks they are the
   only one who broke it is the person who leaves. This is the self-compassion
   intervention and it fits in one sentence.
5. **Your group sees the return, not the gap.** A comeback is a feed event. A
   miss is not.

Grace's underlying rules do not change. What changes is that the app stops
reading the balance sheet to somebody at the exact moment they are deciding
whether to delete it.

### Moment 6, the week: the review

Sunday. What you did, the pattern the data actually shows, and **one** thing to
change. Not a dashboard.

This is also where the coach lives first, because a weekly cadence is the only
one that cannot become nagging.

---

## 5. The coach, in three tiers

ROADMAP theme 2 already set the boundary and the research agrees: **advisory,
never the scorer.** A model's output is not replayable, so it can be recorded as
an event and it can never decide whether a day counted. The best-reviewed system
in this literature won its award for privileging human autonomy, and the
consistent warning is that an LLM should bolster existing relationships rather
than replace them.

**Tier 1, needs no model at all.** The pattern reader. "You have missed Gym on
four of the last five Wednesdays." "Your Water days are 94% when Sleep passed and
61% when it did not." This is SQL over `activity_outcomes`, it is deterministic,
it is testable, and it is probably the most valuable of the three. Build it
first and find out how much of the coach is just arithmetic nobody had shown you.

**Tier 2, the plan editor.** Reads your real press times against your configured
windows and proposes a change: "You press Sleep at 11:10 on average. Your window
closes at 10:30. Move it?" You approve; it writes through the normal insert-only,
future-dated config path, effective tomorrow. It never applies anything itself.
This is the autonomy-preserving shape, and invariant 4 enforces it for free.

**Tier 3, the conversation, and eventually the call.** Voice accountability
products already ship, so this is not far-fetched. It is also the tier where the
product could go badly wrong, and the guard is the same one as everywhere else:
**the coach hands you back to your group.** Its best outcome is "Kabir has done
Gym three days running and you have not spoken this week", not becoming the
relationship.

Four hard rules, whichever tier:

- It never scores, never passes, never fails a period. Invariants 1 and 2.
- Everything it says is recorded as an event, so `check:push`'s equivalent can
  print what it actually told people.
- It never invents a number. Same structural rule as the warm register: the
  figures are computed and handed to it.
- It is opt-in and switchable off, per account, and off is a real off.

---

## 6. The dopamine detox activity

Since it is coming, and the popular framing would produce a feature that does not
work.

- **Build it as a reduction target, not an abstinence vow.** A 2023 trial of 619
  people found that cutting phone use by one hour a day worked about as well as
  giving it up entirely, on anxiety, depression and life satisfaction. Abstinence
  buys nothing extra and is an AVE machine.
- The term never meant reducing dopamine. It is a cognitive-behavioural method
  for disengaging from compulsive behaviour, and the receptor story is unsupported.
  The copy should not repeat it.
- It is a **threshold type** in Curfew's existing vocabulary, like Screen: a daily
  ceiling, a manual entry, a photograph of the screen-time panel as evidence.
  Nothing new is needed in the engine.
- Invariant 9 applies. An automatic read from the OS would be ambient, and the
  member confirms the number.
- Design the over-target day as a data point. The activity whose whole subject is
  compulsive behaviour is the last one that should be punitive about a slip.

---

## 7. What we measure, since "keep them on the app" is the wrong one

| Metric | Direction | Why |
|---|---|---|
| **Completion rate** (scheduled activities done / scheduled) | up | The product's actual job |
| **Comeback rate** (broken runs where the member logs that activity again within 7 days) | up | The AVE metric. Nobody measures this and this whole plan turns on it |
| **Time to press** (median seconds, intent to recorded) | **down** | The strongest retention lever in the research |
| **Median session length** | **down** | A long session means the app got in the way |
| Week-4 retention | up | The standard check |
| Nudge to completion | up | Does the social lever actually pull |
| Feed open to own press | up | Does seeing others make you go |

Two of the seven are things we want to go **down**. That is the whole difference
between this plan and an engagement plan, and it is worth keeping visible.

---

## 8. Everything this overturns, named

Per ROADMAP's closing rule.

| Settled decision | What replaces it | Why the old reason no longer holds |
|---|---|---|
| Clerk everywhere, no encouragement | Three registers by surface | The reason for the rule was that warmth makes claims. That is now prevented structurally instead of by abstinence |
| IBM Plex Mono throughout | Outfit for voice, Plex Mono for every digit | v4 adds prose. The ban on Inter and system-sans stands |
| Zero border radius | One radius token, 16px | The austerity was rejected. Decided, and snapped to Ember's `radius-lg` |
| Home is your own day | Home is your day, then the feed | Relatedness is the strongest lever available and it is behind a tab |
| Reactions do not exist | Reactions and nudges exist | New feature, new tables, decided here |
| AI is not in the product | Advisory tiers 1 and 2 | ROADMAP theme 2, reopened deliberately |

**What does not change, and is now evidence-backed rather than taste:**

- **No app-wide leaderboard.** Duolingo's leagues produced an arms race,
  widespread cheating and real demotion anxiety. Private groups of four to six
  are the shape the research supports.
- **Invariants 1, 2, 9.** Events are the truth, scoring reads only check-ins, a
  check-in is a press. The coach and the feed both live inside these.
- **Money stays optional and IOU-only.** Commitment-device evidence is weaker
  than the folklore, so the fine should not be load-bearing.
- **The window is chosen by the member.** This is the fix for the exact thing
  that killed BeReal, whose imposed window became dread. Never take it.
- **IMMACULATE keeps the only glow.**

---

## 9. What I would build, in order

The order is from the evidence, and it is deliberately not the order that is most
fun to design.

1. **Time to press.** Six-second budget, notification actions, one-tap types,
   Home opening on the next open thing. Largest effect, least glamour.
2. **The Comeback.** The screen where users are lost, rebuilt. Needs no new data.
3. **The design system.** Ember named and extended, two faces, the radius
   decision, the three motion primitives. This is the gate the mocks wait on.
4. **The feed and reactions on Home.** The thing the brief asked for, and it
   needs the design system first or we mock it twice.
5. **Nudges.** Small, and it needs the feed's social plumbing anyway.
6. **If-then plans.** Two config fields, best evidence-to-effort ratio in the
   document.
7. **Coach tier 1.** Arithmetic, no model. Find out how much of the coach is
   already sitting in the database.
8. **The weekly review**, then tiers 2 and 3.

ROADMAP also says theme 1, the per-type review, comes before all of this, on the
grounds that *"a redesign of screens whose rules are wrong just makes the wrong
rules prettier."* That argument still holds and items 1 and 2 above are the only
ones I would run ahead of it, because neither depends on any type's rules being
right.

---

## 10. Settled since this was written

**Radius: one token at 16px.** Section 3. The mocks are built on it, at
https://claude.ai/artifact/Xchf88QXEYFxugjzYbhdQ9

**Ember is the system.** Not a new one. Its retirement in
`.planning/redesign/SYSTEM.md` was made on the strength of a direction that has
since been rejected, and that file is now superseded.
