# Curfew backlog

Work parked with no scope or schedule, so ideas stop getting re-derived. The
invariants in `../CLAUDE.md` still govern anything built from here. Moved out of
`PLAN-v3.md` on 2026-09-01 when v3 was reassigned to the habit-tracker reshape.

## Deferred infrastructure

1. **Postgres RLS** — defence in depth, after the query-layer `assertMember()`
   scoping (invariant 10) is long-proven. No user-visible change. Neon connection
   pooling can silently return unscoped rows if policies and the session role are
   not wired exactly right, so this is high-care, low-visibility work.
2. **DB-backed roles/capabilities** — move roles from the code map to data, with
   an admin UI to create/adjust/delete roles. Design already agreed: roles as
   data, capabilities as code, an undeletable admin role, and a
   delete-a-role-with-users guardrail. Do not start without an explicit go-ahead.

## Ideas

3. **"Awake past curfew" mechanic.** Today nothing penalises being active late at
   night, and it must stay that way for sleep: invariant 2 forbids ambient
   telemetry from affecting a fine, because otherwise the app rewards not opening
   the site. If a "you were clearly awake past curfew" consequence is ever wanted,
   it is a **separate activity type with its own evidence rule**, not a change to
   sleep. Its signal must come from an **explicit action** (a deliberate press,
   the same discipline as invariant 9), never from "user was seen at 3am" session
   or `last_seen` data. Open question if pursued: what explicit action could
   honestly stand in for "awake" without becoming ambient tracking.

4. **More transactional emails on more events.** v2 ships three (invite,
   approval decision, account-removed) through the `sendEmailBestEffort` +
   `mark()` layout in `src/server/email.ts`. Candidate further events, all
   driven by an explicit action or a committed state change, never ambient
   telemetry: invite accepted/declined (tell the inviter), shared-rules change
   (`config.shared.changed`, tell the group), a settlement recorded, a fine
   incurred for a missed period, and a role change. Constraints carry over from
   v2: each send is a side effect that never blocks or reverses the action and is
   recorded as an `email.*` event that scoring never reads (invariant 2); copy
   stays in the clerk voice. Watch total volume; per-user email preferences may be
   needed before adding recurring or activity-driven mail.

## Requests and feedback (after v3)

Two forms in the app, both landing in a new Admin tab:

- **Request an activity type.** The catalog tells users to ask an admin for a
  type Curfew does not have. That ask needs somewhere to go.
- **Feedback.** Free text, tied to the user, visible to admins.

Nothing in the UI mentions the project being open source until it actually is.
