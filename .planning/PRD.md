# PRD — Curfew (working name)

**Owner:** Aman
**Users:** invite-only, admin-approved. Multiple private groups. Not a public product.
**Status:** v1 scoping
**Shape:** a group accountability contract engine. V1 registers one activity
type — sleep — and nothing else.
**Last updated:** 2026-08-31

---

## 1. Problem

Both users want to sleep earlier and consistently fail to. The failure mode is
bedtime procrastination, not insomnia — the ability to fall asleep is not the
issue, the decision to stop scrolling is.

Existing options were evaluated and rejected:

- Gamified sleep apps (SleepTown, Pokémon Sleep) reward engagement at night,
  which competes with sleep, and are trivially spoofed.
- Passive tracking is not achievable in a browser: mobile browsers suspend
  background tabs, and iOS Screen Time data is privacy-shielded.
- Habit trackers with shared streaks exist and are free, but have no cost
  attached to failure.

The mechanism with actual trial evidence behind it is the deposit contract —
loss aversion, not streak rewards. That is what this product implements, with
settlement handled offline.

## 2. Goals

- G1 — Move both users' median wake time earlier and reduce its variance.
- G2 — Make failure cost something real and immediate.
- G3 — Make cheating require deliberate effort, not just laziness.
- G4 — Be boring at night. The app must not be pleasant to open at 23:00.

## 3. Non-goals

- Measuring sleep quality, stages, or duration. We measure compliance with a
  clock, not physiology.
- Holding, transferring, or auto-debiting money. See §8.
- Public signups, discoverable groups, marketing, monetisation. Every account
  is approved by an admin by hand; every group is joined only by invitation
  from its owner.
- Mobile apps. Web only.

## 4. Core mechanic

Three check-ins per night. All three must land in-window for the day to pass.

| Check-in | Window (default) | What it proves |
|---|---|---|
| Night | 22:00 – 22:45 | Committed to bedtime |
| Wake | 06:00 – 07:00 | Got up |
| Confirm | 07:30 – 07:45 | Stayed up |

- A missed check-in is a fail. There is no retroactive logging.
- Each failed **day** produces one fine (default ₹50), regardless of how many
  of the three were missed.
- Streak = consecutive passing days. Two grace tokens per calendar month absorb
  a miss without resetting the streak. **The fine still applies** — grace
  protects the chain, not the wallet.
- `sleep_date` runs noon-to-noon in the user's timezone, so a 00:30 check-in
  attaches to the correct night.

### Known, accepted limitations

- Checking in at 22:40 and staying awake until 01:00 is undetectable. This is
  why the wake and confirm check-ins carry the real weight — they hurt the next
  morning if the night was faked.
- Both users can collude to ignore fines. The system is a ledger, not an
  enforcer. It works because both parties want it to.

## 5. v1 scope

**In:**

1. Email + password auth, server-side sessions in Postgres, 90-day cookie.
   Long expiry is deliberate — no login wall at 22:44.
2. The three check-in windows. Single large button, current window state, time
   remaining. Nothing else on the page.
3. Append-only `events` table as source of truth. Semantic events only, no page
   views.
4. Scoring job (~09:30 IST, see §6a for why the time is approximate) computing
   yesterday's `daily_scores` from events. Idempotent, re-runnable,
   `--from-date` backfill flag.
5. Fine written to `ledger_entries` when a day fails.
6. Balance view + activity feed (rendered from the ledger, newest first).
7. "Settle up" — records a settlement row. Money moves offline via UPI.
8. One chart: both users' actual wake times over the last 30 days.
9. `/verify` route recomputing a date range from events and diffing against
   stored `daily_scores`.
10. Settings screen with the two scopes visibly separated. Personal changes
    are silent; shared changes say plainly that they affect both people and
    take effect tomorrow, and write a `config.shared.changed` event.

**Out of v1 (deliberately):**

- Analytics dashboard beyond the single chart.
- Push notifications / reminders.
- Multiple leaderboards or rankings. One score only.
- Splitwise API integration.
- Retention / archival policy.
- Password reset (2 users, do it by hand).

### Rationale for the cuts

With two users, multiple rankings mean each person tops something and the
penalty stops meaning anything. Charts should be descriptive, never
competitive. And the check-in loop is the part that must be correct — building
dashboards first means shipping with the core untested.

## 6. Data model

See `schema.sql`.

Better Auth owns `users`, `sessions`, `accounts`, `verifications`. We own
`user_approvals`, `groups`, `group_members`, `group_invites`, `activities`,
`user_settings`, `user_activity_config`, `activity_rules`, `events`,
`activity_scores`, `activity_outcomes`, `ledger_entries`.

### Access control

Two independent gates, both manual:

1. **Account** — Google sign-in creates a user; `user_approvals.status` starts
   `pending`. A pending user sees a waiting screen and nothing else: no groups,
   no invites, no data. An admin approves by hand.
2. **Group** — no group is public or discoverable. The owner enters an email;
   the invite appears on that person's dashboard once they are approved.

Enforce membership in the query layer — one `assertMember(groupId, userId)`
helper, every query scoped through it. Postgres RLS is deferred: with Neon and
Better Auth there is no automatic JWT-to-session-variable wiring, so RLS would
mean `SET LOCAL app.user_id` on every transaction, and one missed call under
connection pooling silently returns unscoped rows. Add RLS later as defence in
depth, not as the primary mechanism.

### The activity abstraction

**V1 ships sleep and only sleep.** The abstraction exists so the second type is
a new module rather than a migration — `activity_id` and `type_key` are
miserable to retrofit. It is not permission to build gym, steps or food now.

Everything except the module itself is activity-agnostic: groups, members,
invites, approvals, the effective-dated config mechanism, grace, streaks,
fines, equal split, ledger, balances. None of it knows what sleep is.

The interface every type implements:

```ts
interface ActivityType<Config, Evidence> {
  key: string                          // 'sleep'
  period: 'day' | 'week' | 'month'
  userConfigSchema:  ZodSchema<Config>    // the person's own targets
  groupConfigSchema: ZodSchema<unknown>   // group knobs beyond the fine policy
  evidenceSchema:    ZodSchema<Evidence>  // what a check-in submits
  steps(config: Config, periodStart: Date): CheckinStep[]   // drives the UI
  evaluate(input: {
    periodStart: Date; periodEnd: Date;
    evidence: Evidence[]; config: Config; timezone: string
  }): { passed: boolean; detail: Record<string, unknown> }
}
```

A registry maps `key → implementation`. The engine consumes `{ passed, detail }`
and never inspects `detail`. Adding a type touches the module and the registry;
nothing else.

**Period granularity is part of the interface, not an afterthought.** Sleep and
steps are daily; gym ("3 sessions") and office attendance ("3 of 5 weekdays")
are weekly. Modelling everything as a daily boolean and bolting weekly goals on
later means storing fake daily rows. `activities.period` is denormalised from
the type so SQL can group without loading the registry.

### Three config scopes

| Scope | Table | Holds | Applies to |
|---|---|---|---|
| User, global | `user_settings` | timezone | the person, everywhere |
| User, per type | `user_activity_config` | their own targets — for sleep, the three windows | the person, in **every** group tracking that type |
| Group, per activity | `activity_rules` | fine mode, amount, step, cap, currency, grace, group knobs | one activity, all its members |

All three versioned, insert-only, effective-dated, identical mechanics.

### Why the score tables are split

Personal targets are keyed by **type**, not activity — one bedtime whatever
groups you are in. So a period's pass/fail is group-independent and is evaluated
**once**, in `activity_scores`. Only consequences differ per group, and those
live in `activity_outcomes`: fine, streak, grace. One evaluation, N outcomes.

A check-in is likewise one physical act: one `events` row with no `group_id` and
no `activity_id`.

### Money with more than two people

A failed period writes one ledger row per other **active** member — the fine
split equally among them. Shares must sum exactly to the fine; distribute the
remainder one minor unit at a time with recipients ordered by `user_id`, so ₹50
across three people is 1667/1667/1666, never 1666×3.

If two members fail the same period, both sets of rows are written and
`balances` nets them to zero. Nobody is owed anything, but both lost the period
and both streaks are affected — a ₹0 balance must not read as "nothing
happened", so the UI shows the default separately from the money.

`group_members.joined_at` / `left_at` gate scoring: never fined for periods
before joining or after leaving. Leaving does **not** clear a balance.

## 6a. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router), TypeScript | One deploy target, server actions cover every mutation |
| Hosting | Vercel | Free tier is sufficient at 2 users |
| Database | **Neon** (serverless Postgres) | See below |
| DB access | `@neondatabase/serverless` over the **pooled** connection string | Serverless functions open a connection per invocation; a direct URL exhausts Postgres |
| Migrations | Drizzle Kit, or plain numbered `.sql` files | `schema.sql` is already handwritten; do not let an ORM own it |
| Auth | **Better Auth**, Google OAuth only, database sessions | Free, self-hosted, users live in our own Neon DB. See below |
| Config | Two versioned tables, effective-dated | Shared vs personal scope. See §6 |
| Styling | Tailwind, tokens from `curfew-ui.html` | — |
| Scheduling | Vercel Cron → `/api/cron/score` | See constraints below |
| Timezone | `Asia/Kolkata` fixed. No DST in IST | One less class of bug |

### Neon over Supabase

Supabase free-tier projects pause after roughly a week of inactivity and must
be resumed manually from the dashboard; that takes the Auth API and PostgREST
endpoint down with the database. Neon scales to zero after idle and resumes on
the next query in well under a second. For an app that might go untouched
during a holiday, "degrades on volume" beats "degrades on time".

The rest of Supabase's value is auth, storage, realtime and edge functions —
none of which this app uses, since sessions are hand-rolled against our own
schema.

Neon free tier as of 2026: 0.5 GB storage and 100 compute-unit-hours per
project per month. Our estimated volume is ~18k event rows/year. Not a
constraint.

### Better Auth over the alternatives

Auth.js (NextAuth) v5 sat in beta for years; its team joined Better Auth in
September 2025 and Better Auth took over Auth.js maintenance in early 2026.
Auth.js still gets security patches but new projects are pointed at Better
Auth by its own maintainers. Clerk is free to a generous MAU limit but stores
the user record on Clerk's infrastructure — our `events`, `daily_scores` and
`ledger_entries` all carry FKs to `users.id`, so an external identity store
means mirroring users into our DB via webhook, and a missed webhook means a
user with no row and a check-in that 500s. Not worth it for two people.

Better Auth runs in our app, writes to our Neon Postgres, and Google OAuth is
a provider config.

Consequences for the schema:

- Better Auth owns `users`, `sessions`, `accounts`, `verifications` and
  migrates them via its CLI. We do not hand-write them.
- Its ids are **text**, not uuid. Every FK in `schema.sql` matches.
- Configure plural `modelName`s. The default is singular, which creates a table
  literally named `user` — a reserved word needing double quotes forever.
- `timezone` becomes an `additionalFields` entry on the user model.
- Use the **database** session strategy, not JWT, so `events.session_id` has
  something real to reference and sessions can be revoked.
- Password reset disappears as a concern entirely — Google owns it.

### Admin approval (required, not optional)

Google sign-in means anyone on earth can reach the OAuth callback. Better
Auth's `signIn` hook creates the account, but `user_approvals` is what decides
whether it can do anything. Without that gate the product has public signups,
which §8 forbids for legal reasons, not just tidiness.

### Vercel Cron constraints

- Hobby is capped at **one run per day**, and it fires anywhere within the
  scheduled hour — `0 4 * * *` may run any time before 05:00.
- Schedules are **UTC only**. 09:30 IST is `0 4 * * *`.
- Vercel sends `Authorization: Bearer $CRON_SECRET`. **Verify it in the route
  handler** — otherwise anyone can trigger scoring by hitting the public URL.
- Hobby function timeout is 10s. The scoring job must stay well inside that,
  which at 2 users it trivially does.

Once-a-day-ish is fine: the job only needs to run some time after the 07:45
confirm window closes, and it is already idempotent. No upgrade needed.

## 6b. Check-in interaction

**A check-in is an explicit button press. It is never recorded automatically on
page load.** Rejected auto-recording because:

1. A GET must be safe. Next.js `<Link>` prefetch, browser tab restore, and
   WhatsApp/Slack link previews all fire GETs — any of them would silently
   check you in.
2. Non-repudiation. "I never checked in, the browser did" makes every fine
   arguable, and the ledger only works if both parties trust it.
3. The deliberate act *is* the mechanism. A precommitment you didn't make
   isn't a commitment.

Everything *around* the button is automatic, which is where the UX win
actually lives:

- The page detects the current window server-side and renders only the one
  relevant action. No menu, no date picker, no window selector.
- Already checked in → the button is replaced by the recorded timestamp and
  the next window: `Night check-in 22:41 · next: wake, 06:00–07:00`.
- Outside all windows → no button at all, just when the next one opens.

One tap, and never a decision about *which* thing to tap.

## 7. Success criteria

Measured after 4 weeks of use:

- Median wake time earlier by ≥30 min vs. the first week.
- Standard deviation of wake time under 45 min.
- Both users still checking in at week 4. (Abandonment is the real failure
  mode, not missed nights.)
- Zero disputes that `/verify` cannot resolve.

## 8. Legal constraints

The Promotion and Regulation of Online Gaming Act, 2025 bans online money
games, defining them broadly enough to cover staked competition regardless of
skill, with the ban extending to facilitating related financial transactions.

Multi-group changes the exposure: two named friends recording a private IOU is
materially different from a service other people can create groups on. The
mitigation is that the app is invite-only end to end — every account is
approved by hand, no group is discoverable, and it is never advertised. That
keeps it out of the operator-of-a-service shape in practice; it does not change
what the Act says. **Before this is opened to anyone outside a personal circle,
get an opinion from someone who practices Indian gaming law.**

**Therefore the app must never:**

- Collect deposits, hold funds, or pool money.
- Execute payouts or auto-debits.
- Integrate a payment gateway.
- Open to public signups, or make any group discoverable.
- Be advertised or listed anywhere.

The app computes a number and records an IOU between two named individuals.
Settlement happens offline, peer to peer. If this ever opens beyond the two of
us, this section needs re-reading before anything else.

Separately: if the user base ever grows, storing `ip` in events becomes
personal data under the DPDP Act and needs a stated purpose and retention
limit.

## 9. v2 backlog

Roughly in priority order:

1. **Retention policy.** Purge scoped by event type — drop `login` /
   `last_seen`, keep `checkin.*` and `fine.*` permanently. Estimated volume is
   ~18k rows/year at 2 users, so this is not urgent, but `recordEvent` must
   write filterable types from day one.
2. **Per-user configurable windows.** Schema already supports it via
   `rule_sets`; UI does not.
3. Web push reminders (Android Chrome works; iOS needs an installed PWA and is
   unreliable — treat as best-effort, never as a dependency).
4. Fuller analytics: rolling averages, day-of-week breakdown, streak history.
5. Postgres RLS as defence in depth, once the query-layer scoping is proven.
6. Splitwise deep link on settle-up. Note their API terms bar building an app
   that replicates Splitwise functionality — a deep link is safe, a full API
   integration alongside our own ledger is not.
7. Randomised confirm window to defeat alarm-and-back-to-sleep.
8. **Second activity type: gym.** Self-reported, weekly period, no new evidence
   mechanism. Deliberately chosen as the cheapest thing that proves the
   abstraction handles a non-daily period. Let the *third* type reveal what the
   interface got wrong.

### Activity types considered and their real blockers

The plugin interface solves scoring. It solves none of the following, and each
is the actual reason a type is or isn't viable:

- **Gym / office** — needs evidence: a photo, a geofence, or trust. Start with
  trust; it is a two-person contract, not an audit.
- **Steps** — a web app cannot read Apple Health or Google Fit at all. This
  requires a native app, which is a different project, not a new module.
- **Food / calories** — **out of scope, and not merely deferred.** Photo-to-
  calorie estimation is wide of the mark often enough that it is a poor arbiter
  of money, and attaching financial penalties and peer visibility to what
  someone eats is a mechanism that can reinforce disordered eating. If food is
  ever tracked here, score *logging consistency* — did you log three meals —
  and never the numbers, the amounts, or anything resembling a target.

## 10. Decisions taken and still open

**Taken:**

- Windows and timezone are **per person** (`user_rules`); the fine policy,
  currency and grace allowance are **shared** (`shared_rules`). A NULL
  `user_id` row in `user_rules` is the default new users inherit.
- Fine amount is configurable and shared. `fine_mode` supports `flat` and
  `escalating` (`fine_amount + fine_step * consecutive_failures`, capped at
  `fine_cap`). **Ship with `flat`.** Escalation is built but off — the failure
  mode of escalating fines is someone walking away rather than paying, which
  ends the arrangement entirely. Turn it on later if flat proves too soft; it
  is a config change, not a migration.
- The two users are in **different timezones**. `sleep_date` resolves per
  person, so the same real night is a different `sleep_date` for each. The
  scoring job computes "yesterday" per user, not globally. The activity feed
  shows each person's own local date.
- **Timezone is per person and versioned in `user_rules`**, not stored on the
  user record and not a Better Auth `additionalField`. On relocation,
  historical `sleep_date`s must keep resolving in the timezone in force at the
  time.
- A shared change effective 15 Sep applies to each person on **their own**
  15 Sep, since `sleep_date` is per user. Accepted asymmetry; at a few hours of
  timezone difference it is not observable.
- **History is immutable.** Rule sets are insert-only with a future
  `effective_from`; the app rejects `effective_from <= CURRENT_DATE`. Every
  computation resolves the rule set in force on that night, not the current
  one. So raising the fine from ₹500 to ₹1000 leaves every earlier night at
  ₹500, and ledger rows — which snapshot their own amount and currency — are
  never recomputed at all. `/verify` must use the same effective-dated lookup
  or it will flag all history as drift after any rule change.

- The scoring job processes **every unscored date** from `MAX(sleep_date)` in
  `daily_scores` up to yesterday, not literally yesterday. Vercel Hobby cron is
  best-effort; a skipped run must not silently lose a night.
- A night's verdict is **computed on read** between 07:45 and the cron run, so
  the morning screen is truthful before the job persists anything. The read
  path already evaluates windows; reuse it. Cron only writes.

**Open:**

- Grace tokens: keep at all? If kept, calendar month or rolling 30 days?
  (A grace token absorbs one miss so the streak survives; the fine still
  applies. Purpose is to stop one bad night ending the habit.)
- Actual window times for each person.
- What happens if only one person has signed up — score them anyway, or hold
  until both are in?
- Travel across timezones. v1 answer: nothing. `users.timezone` is set
  manually and rarely.
