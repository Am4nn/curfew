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

### 1.4 The coach lives in two places

Chosen over "a tab only" and "woven into the screens only".

- **Lines** on screens that already exist. Home, After a miss, Your record.
- **A tab** for the longer conversation, where you can ask it something and it
  answers. The v5 tab bar goes from four to five.

`DIRECTION.md` §9 puts coach tier 1 at position seven in its build order and has
no tab at all. That order is superseded by 1.7.

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
before it is a table. See 3.3.

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

Two items left this list on 2026-09-20: the record's register, now 1.11, and
whether theme 1 comes first, now 1.12.

### 3.1 What happens to the clerk copy shipped this week

3.4.3 and 3.4.4 shipped grey-streak strings in pure clerk. *"This week can no
longer be made."* Under 1.11 that sentence is a status line rather than a
number, so it is warm-register work and gets rewritten. Fine, but nobody should
be surprised by it.

### 3.2 Which model, where it runs, and who pays

Not chosen. Vercel Hobby allows 300s per function, so duration is not the
constraint. Cost is, and there is no mechanism in the product to recover it.

### 3.3 How a nudge is rate limited, and whether it can be refused

A member causing a notification on another member's phone has an obvious failure
mode. Curfew already has quiet hours as a real setting that nothing overrides,
and a nudge has to respect them or that setting becomes a lie. Open: a
per-sender cap, a per-recipient cap, whether a member can turn nudges off from
one specific person, and whether the recipient sees who sent it.

### 3.4 The dopamine detox activity

`DIRECTION.md` §6 has it fully argued: a reduction target rather than an
abstinence vow, on a 619-person trial where cutting an hour a day worked about
as well as giving it up. Nothing has been said about whether it is in v4.

### 3.5 The three review items the canvas notes still carry

From the v5 canvas notes, unresolved there: the heatmap on Your record is eight
weeks under a headline about one month and nothing says so; the ceiling tick on
Standing is a single pixel and reads as dust; and the group subtitle needs to
say it lists what YOU share, since no query returns a group's activities.
