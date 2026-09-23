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
