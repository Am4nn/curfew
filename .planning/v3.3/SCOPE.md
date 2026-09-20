# v3.3

Nine items, numbered 28 to 36 to continue from `.planning/v3.2/SCOPE.md`. Items
35 and 36 shipped after 3.3.0, once the chain was verified on a real iPhone.

One feature: Curfew can speak first. Reminders before a window closes, a count
on the icon, and a line saying what the rest of your group has already done.

**Two settled decisions are overturned here.** Both were written down as
permanent and both are named below with the reason they no longer hold, per the
rule at the end of `.planning/ROADMAP.md`. Nothing in this file is a decision
taken quietly.

This lands ahead of ROADMAP theme 4, which is the native app. Push is the one
piece of that theme reachable from a web app, so it comes first and the rest
waits.

---

## The two reversals

**28. Push notifications are no longer out of scope.**

`CLAUDE.md`'s Not in v3 list carried `Push notifications.` It sat under the same
reason as the native app and health integrations: *web only until there are real
users.* There are real users, on three accounts, using Curfew as an installed
home-screen app daily. The condition the deferral named has been met, so the
deferral expires rather than being argued with.

What makes it possible without the native app is that Curfew was already built
as a proper installed web app: `src/app/manifest.ts` has `display: standalone`,
maskable icons and an explicit `id`, `layout.tsx` sets `appleWebApp` and ten
`apple-touch-startup-image` sizes. iOS grants Web Push to a home-screen web app
from 16.4. The install that already exists is the install that qualifies.

**29. Notifications are written in the opposite voice to the rest of the app.**

The Voice section says Curfew is a clerk, not a coach: no congratulation, no
encouragement, no exclamation marks. A push notification breaks that by
existing. A clerk answers when spoken to. A notification speaks first,
unprompted, to a phone lying on a table, and the only reason to send one is to
change what somebody does next.

So the register changes, deliberately and only here:

> Rahul and Priya already logged Gym. Don't be the last one, 40 minutes left!

Writing that as *"Gym closes 8:00 PM. Nothing recorded. 2 of 4 in Morning Crew
have logged."* would have been a worse version of the feature shipped to protect
a rule the feature already broke.

**The exception is the surface, not the sentence.** Every screen is still the
clerk. Copy lives in exactly one file, `src/server/notification-copy.ts`, so the
boundary is a path rather than a judgement call, and `CLAUDE.md` carries the
carve-out so the next person does not read the Voice section and correct it.

ROADMAP theme 3, the Duolingo read, decides whether the rest of the app follows.
Until then this is one file, not a direction.

---

## What ships

**30. Reminders fire before a window closes, and a module may name its own
times.**

Three cues by default, at the deadline minus 120, 45 and 10 minutes, where the
deadline is the window's close or 9:30 PM local, whichever is earlier. The cap
exists because eight of the twelve types have an all-day window whose real close
is midnight, and nobody needs to hear at 11:50 PM that today is nearly over.
Anything landing in the quiet band, 9:30 PM to 8:00 AM, is dropped rather than
deferred: a deferred reminder arrives announcing a window that already shut.

A type may declare its own sensible times instead, as `reminderCues: string[]`
on the module. Food's are breakfast, lunch and dinner. This is a declared field
and not a function, like everything else a module states about itself, and it
keeps invariant 6: the engine never learns what a meal is, it just reads three
strings.

A member may override the cues per activity, in `activity_reminders`. Those rows
are **operational and take effect at once**, so they are plain updatable rows
and not the insert-only effective-dated shape scoring config uses. Invariant 4
governs what judges a period. A reminder time judges nothing.

**31. One notification, not one per activity.**

Six tracked activities across three cues would be eighteen notifications a day,
which is how an app gets its permission revoked in a week. One digest lists
everything outstanding, sets the badge to that count, and opens Home.

Capped at four a day per account, counted from `push.sent` events, so a
misconfigured cue set cannot spam.

**32. The digest says what the group has already done.**

For an activity you track and have not logged, the line names members of your
groups who have. This is the social loop, and it is the reason the feature is
worth building rather than a garnish on it.

It says nothing the group hub would not already show you. The peer set is read
through the existing group path, `assertMember` then `sharesFor`, not a new
query: that path already knows the sharing rules and a second one would not.
v3.1 shipped two bugs of exactly this shape in opposite directions, a group
seeing a member's whole back catalogue and shared evidence never reaching the
group at all, and the second is the one that would hurt here, because a peer
line that silently never fires is indistinguishable from a quiet group.

**A known inexactness, stated rather than hidden.** `period_start` resolves per
user from their zone and their activity's day boundary, so sleep's noon-to-noon
period can carry a different date string for a peer in another timezone. The
query uses the recipient's. The cost is a sentence counting the wrong day for a
peer abroad. It judges nothing and charges nobody, so it is a comment and not a
second resolution pass.

**33. A badge on the icon, from the same payload as the notification.**

The push body is Declarative Web Push JSON. Safari renders it natively and sets
`app_badge` with no service worker involved, because an immutable payload is
displayed by the platform. Chrome does not parse the format, so the bytes reach
the service worker, which parses the same JSON and calls `showNotification` plus
`navigator.setAppBadge`. One payload, both platforms, and no double notification
because Safari skips the worker for an immutable payload.

---

## How it runs

**34. The tick is Upstash QStash, not Vercel Cron, and it is off by default
everywhere except production.**

Vercel Cron cannot do this. On Hobby it is once a day, UTC only, with timing
guaranteed only to the hour. Reminders need minute precision and a tick every
fifteen minutes. QStash was already in the stack for rate limiting, its free
tier covers 96 calls a day many times over, and it retries. It calls
`/api/cron/remind` with the same `Bearer CRON_SECRET` header the score job
already checks, so no new auth pattern and no new package.

The schedule is created by `bun run schedule:reminders`, a script in this repo
with a `--dry` and a `:production` twin, so the tick is a thing under review
rather than a thing somebody once clicked in a dashboard.

> Since 3.4.2 that script is `bun run schedule` and `scripts/schedule-jobs.ts`,
> which declares all three schedules rather than only this one. The argument
> above was made for reminders and then turned out to apply to scoring too: a
> daily Vercel cron in UTC cannot serve two timezones, and a Berlin member was
> judged a day late every day until scoring moved here as well.

`PUSH_REMINDERS` gates the scheduled route and **unset means off**. Everything
else in this repo fails loudly when a key is missing. This one fails silent on
purpose: a notification reaches somebody's phone, so a forgotten variable in a
new environment should produce nothing rather than a schedule nobody meant to
start.

It gates the tick, not the send path. Subscribing and Send a test work
everywhere, because dev is where the whole chain gets verified on a real phone
and a flag that turned that off would make the feature untestable outside
production.

The route answers `200 { ok: true, skipped: "disabled" }` when off, not 401 and
not 500, because QStash retries a failure three times and a refusal has to read
as "did nothing on purpose".

---

## The check

`bun run check:reminders`, beside `check:offer` in CI, for one claim:

> `check:offer` — a button is there when a press would count.
> `check:reminders` — a reminder is sent only when a press would count.

Telling somebody to do a thing the write path would refuse is the same class of
bug as offering them a control that would be refused, and this codebase already
treats the second as first-class.

The case that will actually break is sleep's `confirm` while `waitingOn`.
Calling `windows()` without check-ins returns that window at its widest with the
marker set, and those times are a bound rather than a fact. Sending "Confirm
closes 7:30 AM" off them would be wrong twice over: the window has not started,
and it may never open at those times. `src/server/checkin.ts:268` is the
precedent and the reason it is commented there.

The peer half tests the positive case first, because a clause that never fires
looks exactly like a group where nobody did anything.

---

## 35. Curfew asks, rather than waiting to be found

Shipped after 3.3.0, once the chain was verified on an iPhone.

Settings is where a feature goes to be discovered by nobody. The app asks
instead, on Home, as a dismissible card.

**It cannot be the browser's own prompt firing on load.** iOS grants permission
only from a real tap, so the card is the gesture and its button raises the
system prompt. That indirection is also the safety: a system prompt refused
twice is refused FOREVER on that device, with no way back except browser
settings nobody visits. The card absorbs a "not now" pressed at a bad moment;
the system prompt cannot. Two dismissals and Curfew stops asking, four days
apart, and Settings still has the switch.

**Three things can want the screen on one launch, so they have an order:**

1. The consent gate. Blocking, no dismiss.
2. The notice overlay. Blocking, one press clears all of it.
3. The ask. Dismissible.

Enforced by each one returning null while an earlier one is up, rather than by
z-index, because a card behind a modal is still a card somebody can tab into.

**A new account therefore sees consent, then the ask, and nothing else**, since
notices published before an account existed are never shown to it (decision 80).
An existing member sees what changed first, then the ask.

## 36. Notices are newest first

`pendingNotices` ordered oldest first, which is the order things happened and
the wrong order to read them in. Somebody who has been away opens one overlay
carrying every release they missed, and what they want first is the one that
changes what they do today.

The overlay's date line read `pending.at(-1)`, which meant "newest" under the
old order and silently became "oldest" under the new one. Reversing a query is
never only a query change.

## Build order, and what it turned up

Step 0 was the two reversals, committed before a line of code, because the whole
feature was otherwise built against two standing instructions not to.

Then: the window instants, the migration, the copy bank, the decision layer, the
sender, the routes, the client, the check.

Six things the building walked into.

**The closing time existed and was unreachable.** `getCheckinState` resolved
every window to real `Date`s at `checkin.ts:225` and then threw them away,
keeping `"7:45 PM"` for the screen. That is right for a screen and useless for
arithmetic: parsing a formatted time back into a moment means guessing a date
and a zone, and guessing wrong once a year in the half of it with a different
offset. `opensAt` and `closesAt` now sit beside the labels, null while
`waitingOn` for the same reason the labels are empty there.

**Reading Home writes.** `todayFor` is the obvious way to ask what somebody
still owes, and it goes through `standingsFor`, which calls `closeOutstanding`
and `closeStreaks`. Using it here would have written scoring rows every fifteen
minutes for everybody, forever. `getCheckinState` answers the same question and
writes nothing. This is why `reminders.ts` opens with a paragraph about it.

**Vercel Cron cannot run this job.** Found before building rather than after:
Hobby is once a day, UTC, hour-granularity. The whole scheduler moved to QStash
on that fact.

**The copy tail said nothing.** The first version listed each outstanding
activity's `hint` verbatim and produced *"So close! 2 of 3 meals today. 5 of 8
today. 0 of 20 pages."* Every sentence is true and the last two never say what
they are about, because a module's hint describes its own progress and has no
reason to name itself. It names the activities now, and the unit test that
caught it is the reason the tail is not still shipping.

**The peer flag was being read back out of the copy.** The route decided whether
a notification had mentioned somebody by searching its own text for a phrase.
The copy is picked from a bank, so the cap would have broken silently the day
anybody added a line that worded it differently. It is a field on the digest.

**The check tested three things it was not testing.** Worth recording in full,
because two of the three are the failure mode this file is about:

- The minimum-gap case used food, whose meal step takes a `calories` field the
  press helper did not send. The press was refused, so no check-in existed, no
  gap was running, and food was correctly still outstanding. The test read that
  as the feature being broken. Every press an assertion depends on is now
  checked for having landed.
- The pause case declared a pause starting today, which `declarePause` refuses
  on purpose: backdating one turns a miss that already happened into a day that
  was never scheduled. It declares for tomorrow and walks the clock into it now.
  Inserting the row directly would have dodged the rule and tested a state the
  app cannot reach.
- The sleep case compared an activity's NAME against a step KEY, so it could
  never fail. What is worth proving is about the step: while waiting on the wake
  press it has no closing instant and is not open, which is what `outstandingFor`
  filters on.

## Not in this

- **Time Sensitive on iOS.** A notification that pierces a Focus mode is an
  APNs `interruption-level`, available to native apps only. Declarative Web
  Push's payload carries `title`, `body`, `navigate`, `silent`, `app_badge` and
  `mutable`, and no priority of any kind. This is a real reason to want theme 4
  and it is recorded there.
- **Telling somebody their group saw them miss.** The peer line runs one way: it
  tells you what others did, never broadcasts what you failed to do. The other
  direction is a real retention mechanic and probably wanted, but the consent
  gate does not currently cover it. Theme 3.
- **Rewriting the rest of the app's copy.** Item 29 is one file.
- **Per-activity mute.** The account switch and an empty cue set already cover
  it, and a second mechanism would be a second writer of the same intent, which
  is what caused two production 500s in v3.2.
- **Quiet hours as a setting.** Hardcoded until somebody asks.
- **Deriving the quiet band from sleep's configured wake time.** Correct, and it
  couples notifications to one module's config. Later, if at all.

---

## What the first day in production showed

Everything above is the design as built. It reached production on 2026-09-17 and
was wrong in a way none of the checks above could see. This section is the
record; the work is items 37 to 42 and it is in `main`.

Eight notifications went to two people on the first day. This is what two of
them said, to somebody who had logged nothing:

```
[09:00]  Almost there on Water
         0 of 8 today. Closes at 11:59 PM. Food, Supplements and Reading and 5 more are open too.

[09:30]  Nearly done!
         0 of 8 today. Finish it before the window shuts. Food, Supplements and Reading and 5 more are open too.
```

Six defects, found by pulling the payloads and reproducing the copy by hand:

1. **The bank was chosen on a truthy `hint`.** `if (s.hint) return NEARLY`.
   Water's hint at zero is `"0 of 8 today."`, a non-empty string, so a day with
   nothing logged selected the "nearly done" bank. Not vague. False.
2. **`alsoOpen` emitted a double "and":** "Reading and 5 more".
3. **The lead was sorted by BANK, not by urgency**, so Water closing at 11:59 PM
   led while the two activities closing that afternoon sat inside "and 5 more".
4. **`minutesLeft` and the cue clock disagreed.** Cues capped the deadline at
   9:30 PM; the sentence measured to the raw close. For gym, whose window is the
   whole week, it cued on Tuesday and named Sunday.
5. **The digest had no readable form.** Nine activities cannot be one sentence.
6. **`hint` was the wrong sentence for a lock screen.** It is written for a card
   that already shows the name, so it never names its subject, and three modules
   return pure configuration explanation at zero progress.

### What changed (items 37 to 42)

- **37. One notification, one activity**, replacing the digest. Item 32's
  "one digest per send" is overturned: it was the right call against a cap of
  four and the wrong one without it.
- **38. Six kinds with their own triggers**, in `notification-kinds.ts`:
  `lastcall`, `streak`, `peer`, `sweep`, `reminder`, `done`. A kind is a kind
  because of its trigger, not its adjective. `peer` is event-driven now and
  arrives on the tick after somebody logs. `done` and `sweep` are new.
- **39. The daily cap is gone**, at the user's direction. Three rules replace
  it: one send per tick, a repeat rule per kind, and `reminder` deduping on the
  finished sentence. A day with fifteen things worth saying may say fifteen.
  There is no upper bound.
- **40. `remind()` on the module interface**, a lock-screen sibling to `hint`
  that counts down rather than up. The copy may place it and may not describe
  progress itself, which is now structural: no writer is given a number.
- **41. Quiet hours**, migration 0028, per member, defaulting to 9:30 PM to
  8:00 AM. A gate above the whole registry with **no exception for urgency**,
  including `lastcall`. This overturns "Quiet hours as a setting: hardcoded
  until somebody asks" above. Somebody asked, and the reason it could not stay
  hardcoded is that the old band only filtered engine-derived cues while a last
  call fires off a deadline, and eight types close at 11:59 PM.
- **42. `sim:push` and `check:push`.** The first prints a simulated day's
  notifications with no database; the second prints what really went out, from
  `title` and `body` now stored on the `push.sent` event.

### The lesson worth keeping

Every individual function in the original was correct, and the sentence was
wrong. Typecheck, lint, 301 tests, ten copy unit tests and eight browser suites
were all green over it, because a unit test asserts the string it was told to
expect and cannot ask whether that string makes sense to somebody glancing at a
lock screen.

Writing `sim:push` found four further defects in one afternoon that no other
check in this repo would ever have caught: a notification naming a deadline that
had already passed, a gym streak counted in days when gym's period is a week,
"60 minutes to go" sitting under "closes in 15 minutes", and two activities
whose shared closing time was printed twice in one sentence.

**Copy that can only be reviewed by waiting for a phone to buzz is copy that
ships unread.** That is the whole reason the first version reached production.
