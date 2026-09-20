# ROADMAP.md — the four themes after v3.2

Written 2026-09-16, the night v3.2.0, v3.2.1 and v3.2.2 shipped.

**Nothing here is decided.** These are the four directions the work is pointed
at, written down while they are still themes so that the decisions inside them
get made on purpose. Each one becomes a `SCOPE.md` of its own when it starts,
the way `.planning/v3.1/` and `.planning/v3.2/` did, and a theme is not started
until somebody has written what it actually contains.

They are listed in the order they were said, not the order they should happen.
Sequencing is at the end.

---

## 1. Every activity, reviewed

**CLOSED as a separate theme, 2026-09-20. It folds into v4.** Each of the twelve
types gets its rules reviewed on the same day its screen is redrawn, which
answers this theme's own argument rather than skipping it: you cannot make a
rule prettier and leave it wrong if fixing it is the same sitting. See
`.planning/v4/DECIDED.md` 1.12.

All twelve types, one at a time, end to end.

Already queued in detail in `scripts/drift/NEXT.md`, asked for on 2026-09-15 and
deferred twice since. The shape agreed there: written down per type rather than
as a verdict on the catalog, covering what each one asks for, what it does with
it, what it says on every screen, and whether the rule it enforces is the rule a
person would expect.

This is the smallest of the four and the only one that is already specified. It
is also the one that most changes what the other three are built on: three of
tonight's defects were per-type (gym's phantom gap, sleep's windows in two
places, sleep's confirm anchoring) and every one of them was found by a person
opening a screen rather than by any check. Twelve types have not had that.

**Do this first.** A redesign of screens whose rules are wrong just makes the
wrong rules prettier.

---

## 2. AI in the product

Not yet defined, and the definition is most of the work. What an AI feature
would DO here is the open question, not whether to have one.

Two things to settle before anything is built:

- **What it touches.** Evidence is the obvious candidate and v3 explicitly
  refused it: "AI-derived nutrition from a food photo" is on the Not in v3 list.
  That refusal was about scope, not principle, so reopening it is allowed, but
  it has to be reopened deliberately.
- **What it may decide.** Invariant 2 says scoring reads only `checkin.*`
  events, and invariant 1 says every derived row is rebuildable from events. A
  model's output is neither reproducible nor rebuildable, so anything it decides
  can be recorded as an event and it can never be the scorer. A judgement that
  cannot be replayed cannot be a judgement about whether a day counted.

The safe shape is advisory: something that reads and suggests, never something
that passes or fails a period. If a feature needs to break that, it needs a
decision written down first and probably a new invariant.

---

## 3. Retention, and the redesign that comes with it

**TAKEN, 2026-09-20. This theme is v4.** The argument and the evidence are in
`.planning/v4/DIRECTION.md` and `.planning/v4/RESEARCH.md`; what is actually
decided is in `.planning/v4/DECIDED.md`, which is the file to read first. The
headline: Curfew becomes a coach, AI reads everything a member has plus what
their group shares, seeing who is slipping and nudging them is a second pillar
rather than a feature, fines survive per group, and it all ships on one tag.

**The biggest of the four, and the one most likely to be a new major version.**

The brief: a deep dive, using good AI tools for the research, into how Duolingo
keeps people coming back. Its streak mechanics, its notifications, its onboarding,
its reward loops, its interface. Then the real question, which is not "copy it":
which of those mechanics suit an app whose entire premise is evidence and
consequence, and which would break it.

Expect this to touch everything: the whole UI, the theme, the colour system, the
voice, the shape of a day. A rewrite of the front of the app is on the table.

**This theme collides with the house style on purpose, and that collision is the
interesting part.** What is written down today:

- *Curfew is a clerk, not a coach. It states facts and consequences. No
  congratulation, no encouragement, no exclamation marks.*
- No emoji. Zero border radius. IBM Plex Mono throughout. No glow except
  IMMACULATE's gold halo, which means something precisely because it is the only
  one.

Duolingo is the opposite of every one of those, and it is extremely good at the
thing this theme wants. So the work is not "make Curfew friendlier" and it is
not "keep the clerk and add streak freezes". It is deciding, once and with
reasons, what Curfew is to a person who has missed four days. A clerk states the
consequence. A coach asks them back. Those are different products and the answer
should be chosen rather than arrived at one cheerful string at a time.

Some of the machinery already exists and was built in the clerk's register:
streaks, grace as a pool you spend by hand, ranks, the IMMACULATE halo. Grace in
particular is already a retention mechanic wearing a clerk's clothes. Look at
what is there before adding to it.

**The research is the first deliverable, not the redesign.** A written read of
what Duolingo actually does, what the evidence says about why it works, and what
of it survives contact with an app built on photographs and fines.

**One surface is already answering the voice question, ahead of this theme.**
v3.3 ships push notifications in the coach's register, exclamation marks and
peer names and all, while every screen stays the clerk. That was decided on
purpose and written down in `.planning/v3.3/SCOPE.md` item 29: a notification
speaks first, unprompted, which the clerk has no reason to do, so the register
had to change or the feature was not worth shipping. It is one file,
`src/server/notification-copy.ts`, and it is not a direction until this theme
says so. Read it before the research starts. It is the only evidence Curfew has
about what the warmer voice actually reads like in its own house.

---

## 4. A real app on a real phone

The one that makes Curfew somewhere people live rather than a site they visit.

In scope as described:

- A real app, not a web page in a shell
- Integrations with health apps, so Steps and Screen stop being typed in by hand
- Push notifications
- Reminders
- Haptics, properly, rather than the Android-only `navigator.vibrate` that item
  25 could reach
- And whatever else that list turns out to include

**How it would actually be built is researched in
`.planning/research/native-app/FINDINGS.md`.** The short of it: Google Play
takes the site as it stands, Apple will not, and the reason is that Curfew has
no static version of itself. The API over `src/server/` is the real first
deliverable and it is needed on every path.

**Push notifications already shipped, ahead of this theme.** v3.3 took them,
because they are the one item on this list reachable from a web app: iOS grants
Web Push to a home-screen web app from 16.4, and Curfew was already installed as
one. See `.planning/v3.3/SCOPE.md`. What it could NOT reach is the part that
needs a native app, and that is recorded here rather than lost: a web push
cannot be marked Time Sensitive, so it never pierces a Focus mode. For an app
whose whole point is "the window closes in fifteen minutes", that is the
strongest single argument on this page for building the native app at all.

**This is the theme that reopens the most existing decisions.** Three items on
the Not in v3 list are still here: a native app, health integrations, and Steps
and Screen staying manual. All were deferred for the same stated reason, which
was "web only until there are real users", so the honest gate is whether there
are real users yet rather than whether the features are wanted. Push was the
fourth, and its deferral expired on exactly that test.

Two things to think about early, because they shape everything after:

- **Health integrations and invariant 9.** A check-in is an explicit button
  press, never recorded on page load, because an app that records ambient
  activity rewards not opening it. A step count read from HealthKit is ambient
  by definition. That is not a reason to refuse it, but a step count that
  auto-passes a day is a different product from one a person confirms, and the
  invariant says which of those Curfew is today.
- **Notifications and the voice.** A push notification is the clerk speaking
  first, which it has never done. What it is allowed to say, and how often,
  belongs with theme 3 rather than being decided by whoever writes the first
  one.

---

## Sequencing, as it looks tonight

1. **Theme 1 first.** It is specified, it is small, and it corrects the rules the
   other three build on.
2. **Theme 3's research next**, because it is reading and writing rather than
   building, and because its answer determines the voice and shape that themes 2
   and 4 both have to write inside.
3. **Themes 2 and 4 after that**, in either order, each with a scope file that
   names the invariants it reopens before it reopens them.

Theme 3's build, if it happens as described, is a major version and should be
planned as one: its own directory, its own phases, its own screens, the way v3
was.

## The rule that applies to all four

Three of these reopen decisions that are currently written down as settled, in
CLAUDE.md's Not in v3 list and in the Voice and Visual tells sections. Reopening
a settled decision is allowed and is sometimes the point. Doing it silently is
not. Every one of these themes should say, in its own scope file and before the
first line of code, which existing decision it is overturning and why the reason
that decision was made no longer holds.
