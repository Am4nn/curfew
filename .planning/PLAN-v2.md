# PLAN-v2.md — building Curfew v2

Companion to `PRD.md` (§9 is the source backlog) and `PLAN.md` (v1 build order).
v1 is complete: phases 0-6 built, verified, deployed at curfew.amanarya.com.

This file is the v2 build order and the record of the scope decisions Aman took
on 2026-09-01. It assumes the v1 invariants in `../CLAUDE.md` still hold. None
of them are relaxed by anything below.

---

## Build order

1. **Per-user configurable windows** — UI over existing schema.
2. **Email** — transactional sends on Aman's domain.
3. **Fuller analytics** — member-facing and admin, fully planned then built.
4. **v2.5** — more activity types, then a full UI/UX design review.

Deferred out of v2 entirely:

- **Postgres RLS** → v3. Defence in depth only, no user-visible change, and the
  query-layer `assertMember()` (invariant 10) is what actually protects rows.
  Sequenced after the query layer is long-proven.
- **DB-backed roles/capabilities** → v3. Design already agreed (roles as data,
  capabilities as code, undeletable admin, delete-with-users guardrail). Parked.

Already-planned-into-v1 groundwork that these depend on:

- `recordEvent` writes namespaced, filterable event types from day one, so the
  retention purge (PRD §9.1) stays possible. Retention itself is not scheduled
  here; it becomes relevant only at volume.

---

## 1. Per-user configurable windows

**Status: first. Lowest risk, highest daily value.**

Fully backed by the existing schema, so this is UI plus validation, no
migration:

- The three nightly window times live in `user_activity_config` (per user, per
  `type_key`, insert-only, effective-dated).
- Timezone lives in `user_settings` (already editable via the v1 settings
  screen).

Rules that must hold:

- New config is an **insert** with `effective_from = tomorrow`. The app rejects
  `effective_from <= CURRENT_DATE` (invariant 4). "Effective tomorrow" is the
  user-facing message, same register as the v1 shared-config screen.
- Scoring already resolves config as it stood on the period being scored
  (invariant 5), so past nights keep scoring against the old windows with no
  extra work. Do not touch stored scores.
- Validation: the three windows must not overlap and must sit inside the
  noon-to-noon boundary computed by `periodStart()`. Never inline date math;
  reuse `periodStart()`.
- Personal scope. No owner-announce event (that is for shared config only).

Deliverable: a settings section where a member sets their own three window
times, with the effective-tomorrow notice and inline validation errors (errors
in the UI first, per the v1 feedback rules).

---

## 2. Email

**Status: second. New capability. Overrides the "Not in v1: Email sending"
line in CLAUDE.md as a deliberate v2 lift.**

Scope, transactional only to start:

- Invite email carrying the group invite link.
- Approval decision (approved / rejected).
- Optionally the disabled/removed notice.
- NOT reminders (web push, a separate backlog item, covers that) and NOT
  digests.

Provider:

- **Resend** (confirmed). Aman has an account and is logged in but has **not**
  registered a sending domain yet. Doing that (and deciding which subdomain,
  e.g. `mail.amanarya.com` vs the apex) is part of this item, discussed when we
  start it.
- Needs a verified sending domain and DNS records (SPF/DKIM). That is Aman's
  manual step, blocks this item.

Invariant fit:

- An email send is a **side effect, never truth**. Scoring must never read
  whether an email was sent. If a send needs recording, it is its own event
  type, outside anything `checkin.*` (invariant 2).
- Copy follows the clerk voice: states facts, no exclamation marks, no
  encouragement, no emoji.

---

## 3. Fuller analytics

**Status: third. Plan in full, then build.**

Splits into two surfaces. Both are read models over `events` and
`activity_outcomes`, all derivable from events (invariant 1), no schema change,
no new writes.

- **Member-facing (the valuable half, new surface):** rolling wake-time
  average, day-of-week pass breakdown, personal streak history. A member sees
  their own stats only, scoped through `assertMember()`.
- **Admin (cheaper, plumbing exists):** the same three cuts at group level,
  extending the v1 Insights tab and its inline-SVG chart components.

Constraints:

- Reads only `checkin.*` events and derived outcomes (invariant 2). Never
  sessions, `last_seen`, or login events.
- Day-of-week and any period grouping resolve through `periodStart()` in each
  user's timezone. Do not inline date math.
- Charts stay in the house style: inline SVG, theme tokens, no chart library,
  no AI-slop visual tells.

---

## 4. v2.5

Two parts, in order:

### 4a. More activity types

The `ActivityType` interface plus config/rules rows is the whole extension
point. Nothing outside a module knows what its activity means (invariant 6);
the engine consumes `{ passed, detail }` and never inspects `detail`.

- **Gym first** — self-reported, weekly period, trust-based, no new evidence
  mechanism. Deliberately the cheapest thing that proves the abstraction
  handles a **non-daily period**. Let it reveal what the interface got wrong
  before building the rest.
- **Steps** — manual, self-reported number. Same trust-based shape as gym. No
  Apple Health / Google Fit integration (that needs a native app and is out of
  scope).
- **Food** — self-improvement framing, special UI: user uploads a food image
  plus a calorie figure.
  - **Open decision, flagged, not settled:** PRD §9 rules food out for a
    non-technical reason (money + peer visibility on how much you eat can
    reinforce disordered eating) and says if food is ever tracked, score
    *logging consistency*, never numbers or targets. Aman is overriding the
    out-of-scope call as an owner decision. Claude's standing recommendation:
    the **image is evidence that a meal was logged**, scoring is
    logging-consistency (logged N meals, yes/no), and the calorie figure is
    **recorded and shown to the user only**, never the thing that decides a
    fine or is ranked. Settle the exact scoring rule when food is picked up.
  - **New infrastructure:** v1 has no file storage. Food image upload requires
    a blob store (Vercel Blob is the clean fit). This is why food is the
    heaviest of the three and sits behind gym.

### 4b. Full UI/UX design review

At the end of v2, a whole-app cohesion pass with Claude design against the
house style: IBM Plex Mono, zero border-radius, the token palette, mobile
Safari / Chrome first (primary device), and none of the AI-slop tells in
`../CLAUDE.md`. A cohesion audit once every new v2 surface exists, not a
per-feature pass.

---

## Open items to confirm before their build starts

- **Email provider name** — which service Aman registered for `amanarya.com`.
  Blocks item 2.
- **Food scoring rule** — logging-consistency vs a calorie target. Blocks the
  food module in v2.5, not the rest of v2.5.
