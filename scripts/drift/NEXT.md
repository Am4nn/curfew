# Next session

Last updated 2026-09-21, on v3.4.8.

## Still open

### v4 DESIGN: every screen is drawn, 2026-09-21

The canvas is https://claude.ai/artifact/V5Q54R7heSttj1aXT5PVqP, now **37 boards
in nine rows**, up from 17. Decisions are in `.planning/v4/DECIDED.md`, 1.1 to
1.18, and that file is still the one to read first.

**The three that were owed are drawn.** Monk mode in all three states (`Monk`,
`MonkSetup`, `MonkLocked`), the consent gate (`Consent`), and first run
(`Welcome`, three steps, unskippable, not one model call in it). Monk mode also
has its Home row, a percentage with no flame and no "closes at", inserted into
`Main` above the at-risk section.

**And the v3 gap is closed.** Seventeen more boards, so nothing v3 built is
undrawn: `Signin`, `Catalog`, `Notice`, `Evidence`, `GroupStats`, `Ledger`,
`GroupSettings`, `Invite`, `Settings`, `Sharing`, `Notifs`, `Photos`, `Data`,
`Away`, `Admin`. Three of the old set were deliberately folded rather than
copied, and DECIDED 1.8 says which and why.

**The photographs are real now.** `public/landing/{food,gym,sleep}.webp` are
uploaded to the canvas and used everywhere a member's evidence appears. The CSS
gradient stand-ins are gone.

**Still open, and it is the only thing blocking the build:** the rest of the new
activity types. Cold shower and No junk food are drawn and priced in DECIDED
3.1; whatever else "many more things" meant is unwritten. Each one is a
declarative module, so it is a list to agree rather than a problem to solve.

**Next, and it is no longer a drawing job:** `.planning/v4/PLAN.md` and
`SCHEMA.md`. Phases, tables, order.

**Known cost, accepted, not solved:** the stricter monk bar means one activity
carries two verdicts for one day, and `activity_scores` holds one row per user,
type and period. That needs a second scope, a second pass, and `verify` diffing
both. See 1.16, and `MonkSetup` draws what it buys.

**One thing every future board has to satisfy.** `.design/v5/gen/layout.py`
rebuilds `canvas.json` from a declared row layout and refuses to write it when a
board's root height, its `$preview` height and its frame `h` disagree. Those
three have to be the same number: when they are not, `overflow: hidden` clips
the content and the frame paints the difference as empty background. That is the
bug that cost an afternoon on `Main`.

### Android push is VERIFIED, 2026-09-21. Closed.

3.4.6 fixed a `.strict()` zod schema that accepted every iPhone and refused
every Android, because Chrome sends `expirationTime` and Safari omits it. The
unit tests proved the schema and only a real subscription could prove the path.
Aman resubscribed on Android and it took. Nothing further is owed here.


### A streak goes GREY, it does not drop, shipped 3.4.3 and 3.4.4

Built. Weekly in 3.4.3, daily in 3.4.4, one rule for both. Kept here because
the reasoning is the record and ACTIVITIES.md still describes the old rule.

**Today** a weekly streak is judged only at the Sunday. A three-a-week with
nothing logged reads alive all Saturday, when two days remain and two is not
three. The number is a lie for two days and the whole value of it is that it
is true.

**The rule.**

1. A streak only ever goes UP. +1 per day the activity is done. It never falls
   mid-week and it is never rolled back.
2. The moment the week's minimum becomes unreachable, the streak turns GREY and
   says why. It keeps its value. Sessions logged after that still add, and still
   count against the shortfall.
3. When the week ends, grey offers two doors: spend grace, or start fresh.
4. Ignoring it and logging next week starts a new run from 1 and the offer
   closes, which is what `restoreOffer` already does on the next check-in.

**Why the choice waits for the week to end.** The price is not knowable before
then. Saturday at 0 of 3 the shortfall is 3, but if they go Saturday and Sunday
it is 1. Pricing it early either shows a wrong number or freezes it at 3 and
charges somebody for turning up. Grey on Saturday, priced on Monday, is the only
arrangement where the number is honest the whole time and the price is final
when it appears.

**What was tried and reverted, 2026-09-20, commit `2b8c429`.** Breaking the
streak to 0 the moment the week became unreachable. It works arithmetically and
`bun run simulate` caught what it does to grace: an unreachable week is short by
up to its whole minimum, `restoreOffer` charges the shortfall, so a dead
three-a-week costs 3 against a pool of 2 a month and the offer can never be
afforded. `streak-gym-short-week` went from a 1 grace offer to a 4 grace one.
Grey solves that by not making the week forgivable until its price is final.

**Where it landed.** `StreakState.grey`, `StreakStep.failed` and `.open`,
`activity_streaks.grey` (migration 0030), and a `grey` on `Standing`, `TodayRow`
and the stats row. Four places had been using `current > 0` to mean "the run is
alive", and grey makes that false: `restoreOffer`'s tail scan, `openOffers`'s
fast path, the reminder path, and three flame branches. The simulation caught
the second one; the first and third were caught by reading for the pattern after
the second.

**Daily followed in 3.4.4**, same rule. A missed day greys and holds instead of
erasing, the next day logged is day one of a new run, grace holds without
greying, and a declared pause is still the one thing that goes straight to zero.
It also removed a row branch that keyed off the grace offer rather than the run:
once an offer expired, a forty day run vanished from the row entirely.

**Still on the old rule:** `ACTIVITIES.md`'s worked example says week 3 ends at
zero. `streak.test.ts` says where they part company and why.

### A full review of all twelve activities, asked for 2026-09-15

One type at a time, end to end, and written down per type rather than as a
verdict on the catalog:

- **What it asks for.** Its config, its schedule, its windows, its evidence
  rule, and whether the configure screen states that rule in words a person
  would use.
- **What counts.** Which presses `evaluate` accepts, what it does with more
  than one, what it does with none, and what happens on a day the schedule
  excludes.
- **The streak.** Which days `daysDone` returns and when the count moves.
  Eleven types answer "this day, if it passed"; gym is the one that does not,
  and that asymmetry is where the weekly-streak bug lived before.
- **Reputation and money.** What a miss costs in each group, how grace
  interacts, and whether a fine can be charged at all for that type.
- **The words.** `hint`, `summary` and the status line, against what the type
  actually records.

Worth doing because the last pass of this kind was the fourteen items in
`.planning/v3.1/SCOPE.md`, and it found two leaks and a streak that counted
weekly types wrong. `bun run simulate` and the 266 unit tests cover the engine;
what they cannot say is whether each type's own rules are the rules that were
meant.

### What AI is for in this app, asked for 2026-09-15

Not a chat bot. The two things named: nutrition derived from a food photo plus
whatever the user typed about it, and telling a person what their own patterns
are. **The foundation is the decision, and it comes before any feature.**

This is `CLAUDE.md`'s "AI-derived nutrition from a food photo" under Not in v3,
coming back by name. It was deferred, not rejected.

**The asset is the event log, not the model.** Anyone can put a model behind a
text box. What almost nobody has is three hundred days of timestamped, evidenced
presses with a schedule and an outcome attached to each. Patterns are a question
about that log. Start from what the log can already answer and ask where a model
adds something a query cannot, rather than starting from the model.

Six things any answer has to survive, all of them already written down:

- **A model output is not derivable from events, and `verify` replays
  everything.** Invariant 1 says the derived tables are rebuildable from
  `events`; the nightly `verifyAll` proves it by recomputing and diffing. Ask a
  model twice and you may get two answers, so a recomputed nutrition number
  would report as drift forever. The way out is that a model's answer is an
  INPUT, recorded once and stored, never recomputed. Anything else breaks the
  one property the whole engine is built on.
- **Nothing outside a module knows what a type means** (invariant 6). Nutrition
  belongs inside the food module, behind `evaluate`, and the engine still only
  ever sees `{ passed, detail }`. If a design needs the engine to understand a
  calorie, the design is wrong.
- **A press must stay fast, idempotent and explicit** (invariant 9). A model
  call is slow and can fail. So derivation happens AFTER the event lands, never
  in the path of the button, and a failed derivation must leave a check-in that
  still counts.
- **Money.** If a model's answer can decide `passed`, a model can charge a fine.
  That needs deciding out loud before it is built, not discovered afterwards.
  The safe default is that a derived number informs the person and never the
  ledger.
- **The photo leaves the building.** Evidence is private and currently goes only
  to R2. Sending it to a provider changes what Curfew does with a member's
  photographs, so the Phase 9 consent gate and `src/server/policy.ts` have to
  say so before a single call is made. This is a promise to users, not a
  config change.
- **Retention outlives the photo.** Evidence is deleted after 30 days. A derived
  nutrition row has to survive that deletion or the history goes blank, which
  means it is stored separately and is its own privacy question.

Also: an admin switch, the same as every other system (invariant 11), so it can
be turned off without rewriting history.

**Cost is not the constraint and should stop being discussed as one.** At three
to ten users a food-photo call is a fraction of a cent and a weekly pattern read
is a few cents a user. The bill is under $2 a month. What is expensive here is
correctness, privacy and the ledger.

#### Decided 2026-09-15

- **Spike first, ship nothing.** Two throwaway prototypes to see whether the
  quality is worth any of the below. No schema, no consent change, no route.
- **A model's answer never reaches scoring, streaks or money.** It is shown to
  the person and stops there. A wrong guess must cost nothing, which keeps
  invariants 1 and 7 whole and means a bad model is a disappointing feature
  rather than a false fine.
- **Photo plus the user's own description, to a zero-retention provider**, when
  it ships. Accuracy is the reason; the price is that the consent gate and
  `src/server/policy.ts` say so BEFORE the first call on a real member's photo.
- **Derived numbers live in their own table, written once, never recomputed.**
  They are inputs, not derivations. That is what keeps `verifyAll` from
  reporting every one of them as drift forever, and what lets a nutrition
  history outlive the 30-day evidence deletion.

#### Where it runs, decided 2026-09-15

**AI is never in the press path.** A check-in is a button and it stays a button.
Three placements, and a call that does not fit one of them does not get built:

- **Nightly, with the cron.** Patterns and schedule tuning. Nobody is waiting.
  Note that Vercel Cron does not run on Preview, so dev sees these only when
  `bun run score` is run by hand.
- **After the event has landed.** The photo pipeline. The check-in records
  instantly and the derived row is written when the model answers. A failed
  call leaves a check-in that still counts and a derived row that is simply
  absent, which is the same visible under-write the rest of the app already
  takes, since the driver has no transactions.
- **Racing an interaction the person is already having.** Fire on photo
  capture, while they are still looking at the review screen. The answer is
  there or it is not, and nothing waits either way.

Server-side in every case. The key cannot ship to a browser, so the client
hands over an evidence key and the route does the work, which also means it can
be retried with nobody present.

#### The two spikes

1. **Food, and only food.** The food module declares an optional note box on its
   own check-in screen, so the engine does not learn what a meal is
   (invariant 6). The note is the person's own words and goes in the check-in
   event like any other entered value: it is worth having with the AI switched
   off, and it is not a model output. The press records instantly, the model
   runs after it, and calories and macros go to the derived table.
2. **A page for asking.** Its own route, and the only place a person waits for a
   model, because they pressed the thing that starts it. Two kinds of run: a
   fixed set of reports (the weekly read, cross-activity patterns, schedule
   tuning), and picking one of your own meal photographs and running it with a
   prompt. Single-shot both ways and never a conversation, which is what keeps
   it out of being the chat bot this was explicitly not. Results are stored and
   dated, so last week's read is still there next month and re-running is an
   explicit press rather than a page load.

Deriving numbers from photographs for the OTHER activities is dropped. It only
ever paid for itself by filling the field and saving the typing, and a model's
number never reaches scoring, so what was left was a record nobody asked for.

Sharing does not change. A shared meal photograph reaches the group exactly as
it does today, and the note and the nutrition stay private. No third toggle.

#### One switch in Controls

An `ai` key beside `money` and `photo_evidence`: the union in `app-config.ts`,
a default in `controls.ts`, a row on the Controls screen with the sentence that
says what flipping it does. Nothing new is invented, which is the point.

- **Default off.** It ships off and comes on when the spike says the quality is
  there and the consent text has landed, not before.
- **Off stops every call and hides the page. It deletes nothing.** Invariant 11:
  turning something off never rewrites history, and `controls.ts` already says
  a switch hides a system and switching back restores what was hidden. Meals
  already derived keep their numbers and show them again when it comes back on.
- **The note box stays when AI is off.** The note is the person's own words
  about their own meal. It is not a model output and it does not stop being
  worth recording because the model is switched off. What the switch governs is
  the call, not the person.
- **It is also the incident switch.** One flip stops every image leaving the
  building, which is the thing you want to be one flip on the day you want it.

Easier than every other control, because AI is informational only. No scoring
reads it, so there is no as-of resolution to get right and no period that has to
be judged against the setting as it stood. That is a direct dividend of the
"never reaches scoring, streaks or money" decision.

The admin switch and consent are different questions and both have to be true.
The switch says the system exists at all; the consent gate says this person's
photograph may go to a provider. Neither substitutes for the other.

#### What the mocks have to answer, decided 2026-09-15

- **The app writes every sentence.** The model returns findings as fields and
  the app renders them from its own templates. This is what keeps the Voice
  section of `CLAUDE.md` applying to the surface people read most, and it makes
  the wording testable, which a sentence nobody wrote is not.
- **A range, marked estimated.** "450 to 600 kcal, estimated." A clerk states
  facts, and the fact about a calorie count read off a photograph is that it is
  a range. A single number would state a precision the photograph cannot carry.
- **Calories, the three macros, and the itemised breakdown.** Each thing the
  model says it saw, with its own numbers, adding to the total.
- **Two entry points**: inside `/stats`, which is already where a person goes to
  ask about their own history, and something on Home for reach. Both disappear
  when the switch is off.
- **The picker offers only meals whose evidence still exists**, and says why the
  older ones are not there. Evidence is deleted after 30 days. Keeping a
  downscaled copy to extend that is a separate argument nobody has made yet.
- **Pending and unreadable are drawn**, not discovered in code. A meal between
  the press and the answer, and a meal the model could not read, are states the
  screen has whether or not anybody designed them.

**The itemisation is the reasoning.** Asked for the model's reasoning so a
person can see what it has to say, and that contradicts the app writing every
sentence, because reasoning is prose. The breakdown answers the same need
better: it is how you tell whether 620 is nonsense, and it stays structured.
If prose still looks necessary after the spike, it is quarantined as quoted
machine output the way a person's own note is, and never as app copy.

**Careful with the thing on Home.** `CLAUDE.md` lists generic line icons as
section markers among the visual tells to avoid, and Home is the check-in
surface. A labelled row is likelier to survive review than an icon.

**Two things that follow, and are not decided.**

- **A re-run is a new row, not an edit.** Picking an old photograph and running
  it again with a better prompt is a second derivation of the same meal. Append
  and show the latest, the way `ledger_entries` takes a correction as a
  compensating row rather than an update. "Written once, never recomputed" was
  about the nightly replay and still holds: nothing but a person's press ever
  causes a second run.
- **Evidence is deleted after 30 days, so "do it later" has a deadline.** A meal
  from six weeks ago has no photograph left to select. Either the page offers
  only what is still stored and says why, or this is the argument for keeping a
  downscaled copy, which is a new privacy question and not a small one.

Where the structured output appears is open. The mocks get looked at first.

**The spike must not touch a member's evidence.** Consent has not changed, so it
runs on photographs taken for the purpose and on nothing out of R2. Judge it on
three numbers written down before starting: accuracy against about twenty real
meals weighed or labelled by hand, latency, and cost per call. If accuracy is
not there, the rest of this never happens and that is a good outcome for an
afternoon.

Framework, when the spike is over: the provider SDK directly, one module, no
framework. The app needs one call in one place, and a layer on top would mostly
hide the parts that need deciding. Argue with this rather than assuming it.

### The cutover: done

Ran 2026-09-15. Both branches emptied and rebuilt, Vercel pointed at the right
ones, an admin made, and v3.0.0 then v3.1.0 tagged.

### The big one: closed

Full verification of the engine, then simulation, was the last item on the
original queue. It is done.

- `bun run verify` replays scoring, reputation, the streak, outcomes and the
  ledger and diffs the stored rows. The cron runs it nightly and reports.
- `bun run simulate` lives through 180 days on the real check-in path across 34
  scenarios and 145 assertions: joining, leaving, sharing, un-sharing, grace
  running out, money off, odd splits, four timezone shapes.
- The pass over all twelve activities happened as the fourteen items in
  `.planning/v3.1/SCOPE.md`, and it found what a pass like that is supposed to
  find. Two were leaks.

What is deliberately still true: agreeing with itself is not the same as being
right. `verify` proves the stored rows match a recompute, and `simulate` is the
thing that argues the recompute is right.

### The old text, kept because the reasoning still holds

- Verify scoring, reputation, streak and money calculation end to end, not
  screen by screen. `bun run verify` proves stored rows match a recompute; it
  does not prove the recompute is right. It now covers outcomes, the ledger and
  the streak as well, so the gap is narrower than it was, but the point stands:
  agreeing with itself is not the same as being right.
- Then simulate: several days of varied engagement across groups and
  activities, and check what happens to streaks, personal reputation, group
  reputation, fines and balances in each scenario. Joining, leaving, sharing
  and un-sharing, grace running out, an activity switched off mid-month.
- After that, a pass over all twelve activities, since the gym bugs were the
  kind only a real press finds.

### Performance: done

Home was 6.8 seconds, then 1.9, then 1.2. It is 135ms cold and 88ms warm on the
seeded local database, and a full replay of one user is 346ms rather than 2.9
seconds. Three things did it, all in `.planning/v3/SCORING.md`:

- reputation carries the stored balance forward instead of replaying the curve
  from the join date,
- the streak is stored and moved by the press instead of derived on every read,
- the effective-dated histories are read once per group rather than once per
  day, and the read path above them once per request rather than once per
  activity.

`bun run verify` still replays everything from the beginning, which is what
makes those three safe to trust, and the cron now runs it nightly.

### The review gate

`SCREENS.md` is ticked by a person opening each screen beside its artboard, not
by the harness. Everything on the Gaps page is unticked because it has never
been reviewed, and so are the Configure and Check-in rows and the four from the
check-in feedback work.

### Decisions nobody has made

- **`/settings/personal` sets the same three sleep windows that
  `/activities/sleep` sets**, through a different control, and both are live.
  Two ways to change one thing is one too many. The artboard is drawn as it
  stands and marked, rather than quietly redesigned. Deliberately parked.

### Known, and deliberate

- **Per-commit `*.vercel.app` preview URLs cannot upload a photo.** Each
  environment's R2 bucket allowlists only its own domain, so a preview
  deployment that is not aliased to `dev.curfew.amanarya.com` fails the CORS
  preflight. Fixable by allowing the `*.vercel.app` pattern, at the cost of
  letting any deployment in the account write to the bucket. Left as is.

## Needs a person, not code

- **The production cutover.** Production still serves v2.5 from the old US
  Neon project while `vercel.json` pins `sin1`. That pairing is only safe
  because no tag is cut before the cutover.

## Closed since the last update

- **A fine could be charged twice.** A page read settled fines, splitting among
  whoever was scored so far, and `ledger_one_fine_idx` is per payer-payee pair,
  so a later split with more peers inserted the new shares beside the old ones.
  500 charged as 750, which is invariant 7 broken by a page load. Reads no
  longer settle, and `fine_postings` gives a fine one identity so a replay
  cannot write a second set of entries. `bun run check:money` reproduces it on
  the commit before.
- **Weekly streaks were wrong.** `streakOver` counts days and was handed one row
  per period, so three passed gym weeks reported a streak of 1 while grace was
  spent on weeks that had passed. A module says which of its days count now,
  and the counter is stored.
- **Grace no longer rewinds a streak.** A graced weekly failure rolled the run
  back to the value the week opened on, so the number fell while the app said
  grace protected it. A streak adds one or goes to zero, and grace makes it do
  neither.
- **verify covers the money**, and the nightly job runs it and records the
  result. It reports and never repairs, because a job that rewrites the rows
  every night erases the symptom while the cause runs on.
- **The reputation curve is quantised.** Carrying a stored `numeric(7,3)` score
  forward made its rounding an input, and a week of resumed closes drifted a
  thousandth from a replay. verify caught it on the first run of the
  incremental path.
- The v2.5 streak engine in `src/server/streak.ts` is gone: a second
  implementation with no grace, no schedule, and the type key hardcoded to
  "sleep". Nothing imported it. The name is now the real one.

- The complete-day stamp no longer keeps anything. It used to ask "has this day
  been stamped" and keep the answer in localStorage, which made it a state, and
  a state per browser: a second device stamped the same day again. It marks a
  moment now, firing on the check-in that finished the day and never on merely
  opening Home, so there is nothing to store and nothing to disagree across
  devices.
- `/checkin` and `/ledger` are gone, along with the folder the second one left
  behind. Both were v2.5 redirects rendering nothing, and nothing linked to
  either. The settle form and its action moved up to `src/app/`, beside the
  other shared components, since `/balances` and the group ledger tab both use
  them and the folder they lived in no longer has a page.

- **Nothing in the test suite exercises the real write path.** Still true, and
  still where the gym bugs lived, but both of those are now covered by domain
  tests that assert the declaration rather than the press.
- The nine undrawn routes: seven artboards plus the two signed-out states, all
  on a new `v3 Gaps` page, with a `pending-approval` fixture. `/signin` needed
  no fixture: it checks no session.
- Every route has a loading state shaped like its own destination and an error
  boundary of its own. Home moved into a `(home)` route group so its skeleton
  stops flashing on the way to everywhere else.
- **The harness error-page guard has fired.** Proven end to end by making a
  route throw on purpose: the guard reported `the app's error boundary
  rendered, not the screen` and the entry failed. It had never fired before.
