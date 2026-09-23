# What makes Ren a coach and not a chatbot

Research, 2026-09-23, because Aman asked: *"we should really research on how we
can really make our coach ai coach rather than just a chat bot."*

`DECIDED.md` is still the authority. This file is the reasoning behind the
coach decisions and a set of **proposals**, numbered C1 upward, that become
decisions there when they are taken. Nothing here is settled unless
`DECIDED.md` says it is.

---

## 1. The finding the whole file rests on

**AI coaching matches human coaching on goal attainment. Chatbot habit
interventions produce only small effects.** Same models, often the same
conversations.

What separates them is not the model. Coaching trials run **structured
interactions**; chatbot trials run **conversation**. Bloom, the strongest
recent design work, is built as six evidence-based behaviour change
interactions that an LLM augments, rather than a chat window with a coaching
prompt on top. A scoping review of LLM agents in cardiometabolic care coded
them against the Behaviour Change Technique taxonomy and sorted each technique
into **static, rule-based or templated, or generative**.

That sorting is the tool. Run it over Curfew and the answer to "what should Ren
do" falls out, because most of the evidence base turns out to be **already
built, in code, with no model involved.**

One more finding worth carrying: **working alliance matters less in AI coaching
than in human coaching.** Warmth buys less than accuracy does. That is a second
argument for the rule 3.4 bought the hard way, that a warm writer is never
handed the numbers.

---

## 2. What Curfew already delivers, with no model at all

| BCT | Where it already lives |
|---|---|
| 1.9 Self-monitoring of behaviour | the check-in press |
| 2.2 Feedback on behaviour | streaks, standing, `/stats` |
| 1.4 Action planning | the configure screen |
| 1.5 Review of behaviour goals | settling, effective-dated config |
| 6.2 Social comparison | group shares, ranks, group stats |
| 10.x Material incentive and punishment | fines, split among whoever passed |
| 7.1 Prompts and cues | the reminder tick |

**Seven techniques, delivered structurally.** Ren must not redo any of them. A
model that restates your streak back to you is the v3.3 digest again in a
friendlier voice.

### The one nobody had noticed

**The configure screen is an implementation intention and it was never called
one.** "Confirmed between 8:00 PM and 11:59 PM." "Nothing after 6:00 PM." That
is if-then planning, and forming one carries **d = 0.59 to 0.65 for health
behaviours**, among the largest effects in the field.

Curfew built the highest-leverage technique in behaviour change and labelled it
a settings form. Two things follow, and they are C4 and C5 below.

---

## 3. What is left for Ren

Four jobs. Each is something code cannot do, each maps to a technique the
taxonomy names, and each has a trigger rather than a schedule.

### Job 1. Name the pattern the person cannot see

Your Tuesday Gym problem. Sleep slipping whenever Gym lands late. Water
collapsing at weekends.

**This is the one a chatbot structurally cannot do.** A chatbot has a
conversation; Curfew has a record, with timestamps, photographs, group context
and money. The asymmetry is the whole product.

Lowest risk of the four: it states a fact about stored data. No new screen, no
new table, and it is the natural content of the nightly line.

### Job 2. Coping planning (BCT 1.2)

The missing half of implementation intentions. Not "when will you do it" but
"what goes wrong, and then what".

> "You have missed Gym four Tuesdays running. What is on Tuesdays?"
>
> then: *if the Tuesday meeting runs over, then the morning session instead.*

Biggest evidence base of the four, and the only one that needs somewhere to put
the answer. It is a screen and a table, not a line.

### Job 3. Reframe a miss

What he says the morning after a break. Entirely copy, and section 5 is what
decides it.

### Job 4. Hold you to your own words

**Added because a plan nobody revisits is a plan nobody keeps.** The meta
analyses are explicit that implementation intentions produce their larger
effects **with rehearsal**, so job 2 without job 4 buys the small version of
the effect.

You said: *if Tuesday runs over, morning session instead.* The next Tuesday
morning Ren says: **"Tuesday. Morning session?"**

This is not generation. It is memory plus a trigger, which makes it the
cheapest of the four to get right and the most coach-like thing in the list. It
is also the only one that would survive the model being switched off.

---

## 4. The register: offers, never instructs

**Settled 2026-09-23** (Aman). Self-determination theory: autonomy-supportive
language outperforms controlling language.

> "You might try the morning session." NOT "Move it to mornings."

It also fits who is reading. Somebody using Curfew chose their own activities,
their own targets, their own windows and their own fines. **A coach who
commands a person who set their own rules is arguing with them.**

This sits under 1.11's surviving clerk rule, not over it: every number, time,
money amount and ledger row stays flat. Only the sentences around them offer.

---

## 5. The direction: from compliance to habit

**Aman, 2026-09-23:** *"we can think about this how we can go for being more
habit tracker and its ok we touch foundation."*

### The problem, stated plainly

Lally found new behaviours take a **median of 66 days** to become automatic,
range 18 to 254, and that **missing a single day has no measurable impact**.
Automaticity resumes its climb as soon as the person is back.

Curfew breaks the run on one miss, greys it, and fines it.

Those are not the same instrument. A streak is a **commitment device** and has
its own evidence base. Automaticity is a **habit measure**. Curfew has only
ever built the first and has been describing it as the second.

### What a habit measure would actually be

The mechanism in the literature is **context-dependent repetition**: the same
behaviour, in the same context, repeatedly. Cue consistency is what makes it
stick, which is why the work on cue consistency matters more here than any
streak.

**Curfew already stores what this needs and throws it away.** Every check-in
event carries `at`. Nothing reads it except to decide whether it fell inside a
window. The *spread* of those timestamps is a usable proxy for cue consistency,
and it is sitting in `events` today.

### Proposals

**C1. A second number beside the streak: how established this is.**
Derived from repetitions over a trailing window and the consistency of when
they land. Not consecutive, so one miss does not reset it. Rises with
repetition, falls with irregularity. Lally's 66 days is the natural scale.

Entirely derivable from `events`, so invariant 1 holds and there is no new
source of truth. It does not replace the streak: the streak stays the
commitment device that groups and money hang off, and this is the private one,
like the global score.

**C2. A miss stops resetting the thing that matters.**
It still breaks the run, still costs the fine, still moves the standing. What
it no longer does is zero the habit measure, because the evidence says it
should not. That is what makes "never miss twice" a true sentence rather than a
consoling one.

**C3. Ren's line the morning after is "never miss twice".**
The run is gone, the habit is not, tonight is the only thing that matters. Job
3 resolved.

**C4. The configure screen says what it is.**
One line, where the window is set, naming it as the plan rather than a setting.
The effect size comes from the person *forming* the intention, and a form
nobody reads as a commitment is a form that does not carry it.

**C5. A window is not a cue, and the defaults treat it as one.**
Every declare type ships `20:00` to `23:59`. Four hours is a compliance window;
it is not a context, and "sometime in the evening" cannot become automatic.
This is the first thing the activities review should look at, type by type.

### The honest cost

C1 and C2 touch scoring, the one thing v4 has been careful with. Neither needs
a hostile migration: both are derived reads over `events`, and the streak
tables are untouched. **The risk is not the schema, it is having two numbers on
one row and nobody knowing which one to look at.** That is a design problem for
Home and it is real.

---

## 6. What this makes of Phase 5

`digest.ts` stops being "everything we know" and becomes "what the four jobs
need". Four interactions, four trigger conditions, four shapes of input. That
is a spec rather than a guess, which is the reason this file exists at all.

---

## 7. Safety, and why 3.7 was already right

Bloom's team built a **five-category taxonomy of harms with a few-shot prompt
classifier** returning a boolean and a rationale, applied to the model's
output.

That is 3.3 and 3.7 almost exactly: a guard on what comes out, rather than an
instruction in the prompt hoping it does not. Same argument that made 1.24's
number rule a test instead of a sentence in the prompt. Good sign that the
approach already filed is the field's.

**Their PDF did not parse when this was written**, so the specifics here come
from abstracts. Read it properly before building the classifier.

---

## 8. The activities review, 2026-09-23

All eighteen, against C5. **It corrected C5**, which is why the wrong version
is left standing above rather than quietly replaced.

### Three kinds, and only two can hold a habit

- **Do at a time.** Sleep, office, gym, study, reading, cold shower, sunlight.
  A cue exists and is worth asking for.
- **Do N times.** Water, steps, food, supplements. The cue is per repetition,
  and what matters is anchoring the first.
- **Don't do.** No alcohol, no junk food, no social media, sugar-free,
  nightfast, screen. **No cue is possible, because there is no moment.**

Abstinence is inhibition, not automaticity. Lally's curve does not describe it,
and narrowing a window does nothing for it. What it needs is **coping
planning**, which promotes Job 2 from a Phase 5 nice-to-have to the thing
carrying six of the eighteen.

### Where C5 was wrong

C5 said the 20:00 to 23:59 default was a compliance window that should be
narrowed. The default is a **reporting** window, and tightening when somebody
reports does not help a habit form. It only makes it easier to miss.

The real fault is different and it is C1's problem: **Cold shower and Morning
sunlight confirm at 8 PM for something done at 7 AM.** Their press timestamps
measure when a person remembers to log, not when they act. Feed that to a
cue-consistency measure and it measures nothing.

**Sleep already solves this and nobody generalised it.** Its confirm window is
anchored to the wake PRESS rather than a clock time, built in v3.3 for a
different reason, and it is the only event-anchored cue in the app.

### C6. The reminder time is the cue, and it already exists

**Aman, 2026-09-23:** *"ask user's when is their preferred time so they can be
disturbed and coach can also bug the users at the same time."*

That field is built. `activity_reminders` stores a per-user, per-activity list
of times, `chosenCues()` reads it, and the configure surface already offers it.
It is presented as **when to remind me** and it is really **when I do this**.

One field, three jobs:

1. **The cue.** C1 measures press times against it.
2. **The reminder.** Already what it does.
3. **When Ren speaks.** Job 4's trigger, for free.

**So there is no new control and no new table.** The simplification round's
test passes rather than fails: the configure screen does not get longer,
because the thing being added was there all along under another name.

What is missing is only a default. Three modules declare `reminderCues`, all of
them "do N times": food, supplements and water. **Every do-at-a-time type
declares none**, so the engine falls back to working backwards from the window,
which for a four-hour reporting window is a guess.

### What changes, type by type

| Type | Kind | Today | Change |
|---|---|---|---|
| Sleep | do at time | anchored to wake press | none, it is the model |
| Office | do at time | 10:00 to 14:00 | none |
| Nightfast | don't | confirm 06:00 to 11:00 | none, already right |
| Food | do N | all day, cues declared | none, meals cue themselves |
| Steps | do N | all day | none, ambient |
| Water | do N | all day, cues declared | none |
| Screen | don't | all day | none, no cue possible |
| Sugar-free | don't | confirm 20:00 | none, no cue possible |
| No junk food | don't | confirm 20:00 | none, no cue possible |
| No alcohol | don't | confirm 20:00 | none, no cue possible |
| No social media | don't | confirm 20:00 | none, no cue possible |
| **Cold shower** | do at time | confirm 20:00 | **morning confirm, plus a cue** |
| **Morning sunlight** | do at time | confirm 20:00 | **morning confirm, plus a cue** |
| **Reading** | do at time | all day | **a cue** |
| **Study** | do at time | all day | **a cue** |
| **Supplements** | do N | all day | **already has one** |
| **Gym** | weekly | no window | **a cue** |
| **Condition** | either | confirm 20:00 | **ask which kind when written** |

### C7. A written condition says which kind it is

Six of the eighteen cannot hold a habit and the person writing their own has to
land on one side of that. One question at creation, two buttons: **something
you do**, or **something you avoid**.

It decides what the activity screen shows, whether C1 computes a percentage at
all, and whether the thing offered is a cue or a coping plan. Guessing it from
the label was considered and refused: nothing can read "no doomscroll" reliably,
which is the same reason 1.19 gives them no category.

### C8. Abstinence types say what they are, rather than showing a number

The activity screen shows **Established, 62%** for a do-something type and
**days held** plus the coping plan for a don't type.

Computing the percentage from days-held for both was the tempting shortcut and
it is the settling-day bug again: a number that measures one thing while its
label claims another. 3.4.1 already cost a release to that.

---

## 9. Two faults found by using it, 2026-09-23

**Aman:** *"Food is a thing which I have selected to have 3 times but sometimes
I eat 2 times only and that just counts streak broken and sometimes I forget to
log Food too so thats a bummer for curfew as it skips."*

Both are the same mistake in two places: **Curfew punishes things that are not
failures of the behaviour.** Eating slightly less, and being human about a
phone.

### C9. A target is not a bar. Do-N types get a floor

`pass.ts:33` is `checkins.length >= rule.min`, so a configured 3 is a **hard
bar** and eating two scores identically to eating nothing.

That is right for a commitment device and wrong for a habit tracker, which is
what 1.47 says the app is becoming. A missed third meal is a normal day.

> **Meals a day: 3.** Counts as a miss under **2**.

Only the floor breaks a streak or costs money. The target feeds C1 and gives
Ren something true to say, which is the first thing in the app that uses a
number for coaching rather than for judging.

**The default floor is the target minus one**, so it forgives exactly one and
is never decorative. A floor equal to the target is the old behaviour and stays
available for somebody who wants it.

`floor` is **optional and null-by-default in the schema**, so every config row
written before it existed parses unchanged and is judged exactly as it was
(invariant 4 and 5 both hold, and there is no migration).

The same shape fits Water, Steps, Reading and Study. Food first, because that
is where it was felt.

### C10. A late log, with the camera, and the photo need not be the food

Food is `evidence: { level: "required", source: "live" }`. A meal you forgot to
photograph **cannot be logged at all**, ever, because a live camera cannot
photograph a meal you already ate. The rule that makes Food trustworthy makes
forgetting unrecoverable.

**Aman:** *"log it with camera where photo can be not food."*

That is the right instinct and it makes the mechanism honest about itself. **The
live camera was never proving the meal.** Nothing in the app has ever inspected
a photograph. What it proves is that somebody was present and deliberate at the
moment of logging, and that is worth keeping: it is what stops a week being
backfilled in one sitting.

So a late log:

- is allowed until the period has been closed a few hours, and no longer,
- takes a live photo like any other press, of whatever is in front of you,
- carries `late: true`, and its evidence is **never shared to a group and never
  sent to Ren** (1.22), because it is not a picture of the meal,
- **does not feed C1's cue measure.** A press at 11 PM for a lunch is exactly
  the timestamp the cue measure must not read, which is the same fault the
  activities review found in Cold shower.

Every invariant survives: still an explicit press (9), still a server timestamp
(8), still one event (1), still scored from `checkin.*` alone (2).

### C11. Same as yesterday

Lifesum's cheapest good idea. One tap repeats the last period's entry, for
every type that takes a number: Food, Water, Steps, Reading, Study, Screen.

It attacks forgetting at the source by **making the honest path the fast path**,
and it needs no new data, since it reads the previous period's own check-ins.

The objection is real and worth writing down: invariant 9 exists because a
press should be a deliberate act, and a one-tap repeat is the nearest thing in
the app to logging without looking. What keeps it honest is that it still
requires the press, and for Food it still requires the camera, so it saves
typing rather than attention.

### C12. Take Lifesum's mechanics, not its database

**Learnable and cheap**, all of it serving 1.47:

- **Degrade rather than break.** Its Life Score falls; nothing snaps. C9 is the
  first step and C1 is the rest.
- **Same as yesterday.** C11.
- **More ways to log.** Photo, voice, barcode, text, quick-track. Curfew has
  exactly one path per type, and friction is why people forget.

**Not taken:** the food database, barcode scanning, macros, recipes, meal plans
and wearable integrations. That is a different product and a subscription
business, and it overturns two entries on the "Not in v4" list rather than
extending one. If it is ever wanted it gets its own theme and its own argument,
the way ROADMAP holds everything else.

**Curfew stays a habit tracker that happens to handle food well.**

---

## Sources, read 2026-09-23

- Bloom: Designing for LLM-Augmented Behavior Change Interactions, CHI 2026
- LLM-based conversational agents for behaviour change support, an RCT, IJHCS 200
- An LLM-Based Motivation-Aware Framework for AI Coaching, CHI 2026
- Behavior Change Content of LLM-Driven Agents in Cardiometabolic Care, scoping review
- BCT Taxonomy v1, Michie et al.
- Human vs AI chatbot coaching RCT, HRDI 29(4), 2026
- Comparing AI and human coaching goal attainment efficacy
- Human, AI and hybrid health coaching, systematic review, Frontiers Digital Health 2025
- Working alliance in AI vs human coaching, Frontiers Psychology
- Gollwitzer and Sheeran on implementation intentions, d = 0.65
- Lally et al., habit formation in context, and the 66-day median
