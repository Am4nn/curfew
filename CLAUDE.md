# Curfew

A group accountability contract engine. People form private invite-only
groups, commit to an activity, and pay each other when they miss. V1 tracks
**sleep only** — three timed check-ins a night.

## Read these first

- `PRD.md` — what and why. Decisions with their reasoning.
- `PLAN.md` — build order. Seven phases. §0 is manual setup, §1 is the rules
  below.
- `schema.sql` — the data model, with the immutability rules in comments.
- `curfew-ui.html` — design reference: tokens, layout intent, copy tone.
  **Not code to copy.** It is hand-written CSS; the app is Tailwind.

## Current phase

<!-- update this line after each phase -->
**Phase 5 complete — Groups.** Phases 0-5 are done. Phase 5 adds group create,
invite by email, accept/decline, leave (balance survives), the admin approvals
screen, and the multi-group dashboard at `/` (check-in moved to /checkin, still
forced dark). The auto solo-group was dropped; new users create or join a
group. A second group works with no change to Phase 1-4 code. Do not start
Phase 6 without being asked.

## Invariants

These are not style preferences. Breaking one is a bug even if tests pass.

1. **`events` is the only source of truth.** `activity_scores`,
   `activity_outcomes` and every view are rebuildable from it. If you find
   yourself needing a fact that isn't derivable from events, say so rather
   than adding mutable state.
2. **Scoring reads only `checkin.*` events.** Never sessions, never
   `last_seen`, never login events. Ambient telemetry must not affect a fine —
   if it can, the app rewards not opening the site.
3. **`ledger_entries` is append-only.** No `UPDATE`, no `DELETE`. Corrections
   are compensating rows. Settlements are rows.
4. **Config is insert-only with a future `effective_from`.** The app rejects
   `effective_from <= CURRENT_DATE`. Nothing in the DB enforces this.
5. **Resolve config as it stood on the period being scored**, never as it
   stands now. See the immutability block in `schema.sql`. This applies to
   `/verify` too, or it reports all history as drift after any config change.
6. **Nothing outside an activity module knows what "sleep" means.** The engine
   consumes `{ passed, detail }` and never inspects `detail`. No `night_ok`
   anywhere except inside the sleep module.
7. **Money is integer minor units plus a separate currency code.** Never
   float. The decimal exponent comes from the currency — never a hardcoded
   `/100`. Split shares must sum exactly to the fine.
8. **Server timestamps only.** Client clocks are editable.
9. **A check-in is an explicit button press.** Never recorded on page load.
   GETs fire from prefetch, tab restore and link previews. See PRD §6b.
10. **Membership is enforced in the query layer**, via one `assertMember()`
    helper, on every query. RLS is deferred and is not a substitute.

## Conventions

- `periodStart()` is the single place the noon-to-noon boundary is computed.
  Never inline date math elsewhere.
- Event types are namespaced and stable: `checkin.sleep.night`, not
  `night_checkin`. Renaming later means a `CASE` mapping forever.
- All events go through one `recordEvent()` helper. No inline inserts.
- Better Auth ids are `text`, not uuid. Table names are plural — the default
  singular creates a table called `user`, a reserved word.
- Two Neon connection strings: pooled for the app, direct for migrations.

## Not in v1

Do not build these even if you're already in the area:

- Any activity type other than sleep
- Push notifications
- Any payment integration (legal constraint — PRD §8)
- Multiple leaderboards or rankings; there is one score
- Retention or archival policy
- Email sending
- RLS

## Commands

Package manager is bun.

```
dev        bun run dev       — Next.js dev server
test       (Phase 1)         — Vitest, domain core
migrate    bun run migrate   — apply migrations/*.sql over DIRECT_URL
verify     (Phase 3)         — recompute a date range and diff stored rows
```

## Voice

Applies to chat replies, commit messages, code comments, and every string
that ships in the UI.

**Never use em-dashes.** Use a full stop, a comma, or a colon.

Banned constructions:

- "It's not just X, it's Y" and every variant of that shape
- Colon-then-reveal ("The result: a faster app")
- Scare quotes around invented labels
- "Let's dive in", "delve", "seamless", "robust", "leverage", "elevate",
  "unlock", "in today's fast-paced world", "at the end of the day"
- "Worth noting", "it's important to note", "that said"
- Rhetorical questions used as headings
- Trailing summaries that restate what was just said
- Emoji in UI copy, commits, or replies

In chat: answer, then stop. No preamble, no recap of my request, no offer of
next steps unless I asked. If the answer is one line, send one line.

In the UI: Curfew is a clerk, not a coach. It states facts and consequences.
No congratulation, no encouragement, no exclamation marks. "Window closes
07:45. Miss it and last night doesn't count." is the register. "Great job on
your streak!" is not.

## Visual tells to avoid

The mock is deliberately not a default AI-generated interface. Do not drift
back toward:

- Purple or indigo gradients, glassmorphism, glow effects
- Cards with rounded corners and drop shadows on everything
- Centred hero text with a large gradient headline
- Emoji or generic line icons as section markers
- Inter or system-sans everywhere. This project is IBM Plex Mono throughout.
- Pill buttons. Zero border radius is the house style.
- Colour as the only carrier of meaning. Signs and labels carry it too.

## Working style

- Raise contradictions between the docs rather than picking one silently.
- Prefer saying a design is wrong over working around it.
