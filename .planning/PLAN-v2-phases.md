# Curfew v2 — implementation plan (3 phases)

Execution detail under `PLAN-v2.md` (which holds the scope and ordering). This
file is a handoff spec: another agent implements each phase. It names the exact
files, the existing helpers to reuse, and the invariants each phase must not
break. The v1 invariants in `../CLAUDE.md` all still hold; nothing here relaxes
them.

Exploration finding that reshaped the scope: **per-user window editing already
shipped in v1** (the settings screen has the six time inputs, effective
tomorrow, via `updateSleepWindows`). So Phase 1 is a small validation-and-polish
task, not a from-scratch build. Phases 2 and 3 are genuinely new.

Decisions taken (Aman, 2026-09-01):
- Windows: validation + polish, plus an "i" info affordance explaining the feature.
- Invite email: deep-link to the dashboard (no tokenized accept route).
- Analytics: expand the existing `/chart` page (no separate route).

---

## Phase 1 — Window validation + info affordance

**Goal:** the existing personal-windows editor rejects nonsensical window sets
with a clear inline message, and a small "i" affordance explains what the
windows are and that changes take effect tomorrow.

### What exists (reuse, do not rebuild)
- Writer: `updateSleepWindows(userId, windows)` — `src/server/settings.ts:52`.
  Parses via `sleepConfigSchema` (HH:mm format only), inserts effective-tomorrow.
- Action: `updateWindowsAction` — `src/app/settings/actions.ts:38`. Reads the six
  fields, returns `FormState` (`{ ok }` / `{ error }`), already renders errors via
  `ActionForm`.
- UI: `WINDOW_FIELDS` + six `<input type="time">` — `src/app/settings/page.tsx:21`
  and `:98`.
- Sleep domain: `sleepConfigSchema`, `STEPS`, `windows(config, periodStart, tz)`,
  `instantWithin` — `src/domain/sleep/index.ts`. `windows()` returns absolute
  `{ step, label, opensAt: Date, closesAt: Date }` per step with noon-to-noon
  anchoring (pre-noon times roll to day+1).
- Timezone resolver: `resolveUserTimezone(userId, asOf)` — `src/server/config.ts:14`.
- `periodStart()` — `src/domain/period.ts:15` (the only noon-to-noon computation).

### The gap
Validation today is HH:mm format only. A user can save `night_open` after
`night_close`, or windows that overlap, or that fall outside the noon-to-noon
span. All pass and corrupt scoring silently.

### Work

1. **Domain validator** in `src/domain/sleep/index.ts` (keeps sleep semantics
   inside the module — invariant 6). Add a pure function, e.g.
   `validateSleepWindows(config: SleepConfig, timezone: string): string[]`
   returning human-readable errors (empty = valid). It must validate on the
   **resolved instants**, not the raw HH:mm strings, because wake/confirm roll to
   day+1:
   - Resolve the three windows via `windows(config, <any periodStart>, timezone)`.
   - Each window: `opensAt < closesAt`.
   - Order + no overlap: `night.closesAt <= wake.opensAt` and
     `wake.closesAt <= confirm.opensAt`.
   - All instants inside the noon-to-noon span
     `[periodStart noon, next-day noon)` for the chosen periodStart.
   - Copy in clerk voice, e.g. "Night window closes before it opens." /
     "Wake window overlaps the night window."
2. **Call it in the writer**: in `updateSleepWindows`, after `sleepConfigSchema.parse`,
   resolve the user's timezone (`resolveUserTimezone(userId, tomorrow())`), run
   `validateSleepWindows`, and `throw new Error(errors[0])` if non-empty. The
   existing action already turns a thrown message into `{ error }` shown inline.
   Validate against the same date the config takes effect (tomorrow).
3. **Unit tests** (Vitest, domain core): valid set passes; each failure mode
   (reversed, overlap, outside boundary) returns the right message. Put beside the
   existing sleep tests.
4. **Info affordance**: a small reusable client component, e.g. `InfoHint`
   (`src/app/ui.tsx` or a new `src/app/info-hint.tsx`), rendering an "i" marker
   with a tooltip/popover. Requirements:
   - Theme-aware (uses tokens, works in light and dark).
   - Works on touch (tap to toggle), not hover-only — mobile is the primary
     device. No emoji, zero border-radius, IBM Plex Mono, house style.
   - Placed next to the PERSONAL windows section heading in
     `src/app/settings/page.tsx`. Copy explains: the three nightly windows
     (night check-in, wake check-in, confirm check-in), that a check-in is an
     explicit button press inside its window, and that changes take effect
     tomorrow, not today.

### Must not break
- Invariant 4 (effective-tomorrow) and 5 (resolve config as it stood): unchanged;
  we only add validation before the existing insert.
- Invariant 6: no window semantics leak outside the sleep module. The validator
  lives in `src/domain/sleep/`.

---

## Phase 2 — Transactional email (Resend)

**Goal:** send three transactional emails on Aman's domain: group invite,
approval decision (approved/rejected), and account-removed notice. Best-effort,
never blocking or reversing the core action.

### Preconditions (Aman, manual — blocks this phase)
- Resend account exists (confirmed). **Sending domain not yet registered.** Decide
  subdomain (e.g. `mail.amanarya.com` vs apex) and add SPF/DKIM DNS records in
  Resend. Discuss before implementing.
- Add `RESEND_API_KEY` and `EMAIL_FROM` to the deployment env.

### What exists (reuse)
- Env pattern: `src/lib/env.ts` — `raw` (reads `process.env.*`), Zod `schema`,
  `safeParse` that throws at boot. Add both new vars in all three spots plus
  `.env.example`. `BETTER_AUTH_URL` already present (dev default
  `http://localhost:3000`) — the single source for absolute links.
- `recordEvent(input)` — `src/server/events.ts:12`. Use an `email.*` namespace for
  send records; it stays clear of `checkin.*`, the only namespace scoring reads
  (invariant 2, enforced at `admin.ts` filter `like(events.type, "checkin.%")`).
- User email lookup: `users.email` by id — `src/db/schema/auth.ts:15`; precedent
  join `userApprovals`→`users` at `admin.ts:148`.
- Hook points:
  - Invite: `inviteToGroup(groupId, inviterId, email)` — `src/server/groups.ts:32`.
  - Approval: `decideApproval(adminId, userId, approve)` — `src/server/admin.ts:348`.
  - Disable: `disableUser(adminId, targetUserId)` — `src/server/admin.ts:417`.

### Work

1. **Dependency + client**: add `resend`. Create `src/lib/email.ts`: a thin
   wrapper holding one Resend client from `env.RESEND_API_KEY`, exposing
   `sendEmail({ to, subject, html, text })` that sends from `env.EMAIL_FROM`. All
   copy in clerk voice: states facts, no exclamation marks, no encouragement, no
   emoji. Absolute links built from `env.BETTER_AUTH_URL`.
2. **Send-once idempotency**: the three commit-point functions currently do not
   return the affected row, so a duplicate call (already-invited, already-decided)
   would resend. Add `.returning()` and send the email only when a row actually
   changed:
   - `inviteToGroup`: `.returning()` on the insert; the `onConflictDoNothing`
     no-op returns nothing → send only on a real new invite. Look up the group
     name for the copy. Recipient is the invited `email`.
   - `decideApproval`: `.returning()` on the update (filtered to
     `status = 'pending'`); send only on a real pending→decided transition. Look
     up the target user's email by `userId`. Approved and rejected are different
     bodies.
   - `disableUser`: send the removed-notice after the `disabledAt` update; look up
     the target's email.
3. **Non-blocking**: email send is a side effect. Wrap each send in try/catch
   **after** the DB commit; a failed send must not throw out of the action or roll
   back the approval/invite/disable. Record the outcome with `recordEvent`
   (`email.invite.sent`, `email.approval.sent`, `email.disabled.sent`, and a
   failure variant or a `sent: false` payload). No retry/queue in v2 (best-effort,
   documented).
4. **Copy** (deep-link model, per decision): invite email says a group invited
   them to Curfew, they sign in **with Google** at the app link, get approved, and
   accept on their dashboard. Approval email states the decision. Removed email
   states access ended and any balance still stands. Every link points at
   `env.BETTER_AUTH_URL` (dashboard root) — there is no tokenized accept route.

### Must not break
- Invariant 2: scoring never reads `email.*`. Invariant 8: `occurred_at` stays the
  server clock (recordEvent already enforces).
- CLAUDE.md "Not in v1: Email sending" is now a deliberate v2 lift; update that
  note when the phase lands.

---

## Phase 3 — Fuller analytics (expand /chart + admin)

**Goal:** members see personal stats on the existing `/chart` page (rolling
wake-time average, day-of-week pass rate, streak history); admins get group-level
versions on the Insights tab. All read models over `events` /
`activity_scores` / `activity_outcomes`, derivable from events (invariant 1), no
schema change, no new writes.

### What exists (reuse)
- Member chart page: `src/app/chart/page.tsx` (`WAKE TIMES`) → `getWakeChart`
  (`src/server/chart.ts:25`) → `WakePlot` inline SVG. Group-scoped, one series per
  member. This is the surface to expand.
- Chart components: `TimeChart` (bar/line inline SVG, `<title>` hover, theme
  tokens, `baseZero`, `fmt`, `suffix`) and `Figure` — `src/app/admin/insights/charts.tsx`.
  Currently under the admin folder; **extract to a shared module** (e.g.
  `src/app/charts.tsx` or `src/components/charts.tsx`) so both `/chart` and admin
  Insights import the same component. `Point { date, value }` is the shared shape.
- Admin insights read model: `src/server/insights.ts` — `checkinsPerDay`,
  `passRateOverTime`, `finesPerDay`, `wakeTrend` (per-user tz, JS grouping),
  `outstandingBalances`. These are **system-global** (no user/group filter).
- Per-user read precedent: `getUserInspector` (`admin.ts:189`) already reads a
  user's `recentScores` and `recentOutcomes` — the exact shape a personal view
  reuses, currently gated behind `users.view`.
- `resolveUserTimezone`, `periodStart`, `formatMoney`, `hhmm` formatter (in
  `insights/page.tsx:16`). `assertMember` — `src/server/membership.ts:9`.

### Work

1. **Extract shared charts**: move `TimeChart` + `Figure` (and the `Point` type /
   formatters they need) into a shared module; update the admin Insights imports.
   Keep `BalanceBars` where it is unless the member page needs it.
2. **Member read model** — new `getPersonalStats(userId, days = 30)` in
   `src/server/chart.ts` (or a new `src/server/stats.ts`), scoped to the session
   user only (no capability needed; scope by id):
   - **Rolling wake-time average**: from this user's `checkin.sleep.wake` events,
     minutes-after-local-midnight per period (reuse the `wakeTrend` JS-grouping
     approach, user-scoped via `resolveUserTimezone`), plus a rolling mean (e.g.
     7-day). Line chart, `baseZero={false}`, `hhmm` formatter.
   - **Day-of-week pass rate**: from this user's `activityScores` (group-independent
     — "did you meet your own targets"), derive weekday from `periodStart` via
     Luxon, aggregate pass% per Mon..Sun. Bar chart, `%` suffix.
   - **Streak history**: streak lives per group in `activityOutcomes.streakAfter`.
     For each group the member is in (guard each with `assertMember`), a line of
     `streakAfter` over `periodStart`. If the member is in one group, one line; if
     several, one `Figure` per group. Keep it descriptive, never ranked.
3. **Expand `/chart` page**: add a personal section above/below the existing group
   wake plot, rendering the three charts from `getPersonalStats` with `TimeChart`.
   Keep the page's existing per-group wake plot. House style throughout.
4. **Admin group-level versions**: add day-of-week pass rate and rolling wake
   average to `src/server/insights.ts` as new global functions, and render them on
   `src/app/admin/insights/page.tsx` with the shared `TimeChart`, gated by
   `insights.view` as the tab already is. (Streak history is awkward as a single
   global aggregate; leave per-group streak to the member view for v2 and note it
   as a possible later drill-down.)

### Must not break
- Invariant 2: reads only `checkin.*` events and derived scores/outcomes. Never
  sessions/`last_seen`/login.
- Invariant 10: any group-scoped read goes through `assertMember`. The member
  stats page shows only the signed-in user's own data.
- All period/day-of-week grouping goes through `periodStart()` / the user's
  resolved timezone. No inline date math. Charts stay inline SVG, theme tokens, no
  chart library, none of the AI-slop visual tells.

---

## Verification (per phase)

**Phase 1**
- Vitest: `validateSleepWindows` unit tests (valid; reversed; overlap; outside
  boundary).
- Manual: in Settings, save an invalid window set → inline error, no write. Save a
  valid set → effective-tomorrow. Tap the "i" on mobile viewport → explanation
  shows and dismisses. Light and dark both correct.
- `bun run typecheck` and build clean.

**Phase 2**
- With a verified Resend domain (or test key): trigger an invite, an approve, a
  reject, a disable → correct email arrives, correct copy/voice, links resolve to
  the deployed origin.
- Duplicate the action (re-invite same email, re-decide) → **no** second email
  (the `.returning()` guard).
- Simulate a bad `RESEND_API_KEY` → the core action still succeeds, a failure
  event is recorded, nothing throws to the user.
- Confirm `email.*` events exist and scoring/verify are unaffected
  (`bun run verify` shows no drift).

**Phase 3**
- Seed a user with check-in + score history; open `/chart` → personal charts
  render, numbers match a hand recompute (wake average, weekday pass%, streak).
- A member sees only their own data; a group streak view refuses a non-member
  (assertMember).
- Admin Insights shows the new group-level charts, gated by `insights.view`.
- `bun run typecheck`, build, and `bun run verify` clean.

---

## Deferred (do not build here)
- v2.5: more activity types (gym → steps → food) then a full UI/UX review.
- v3: Postgres RLS, DB-backed roles/capabilities.
- Open item before Phase 2 code: the Resend sending subdomain/from-address.
