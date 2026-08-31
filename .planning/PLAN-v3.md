# Curfew v3 — backlog

A holding file for work deferred past v2 and v2.5. Nothing here is scoped or
scheduled. It exists so ideas stop getting re-derived. The v1 invariants in
`../CLAUDE.md` still govern anything built from this list.

## Carried over

1. **Postgres RLS** — defence in depth, after the query-layer `assertMember()`
   scoping (invariant 10) is long-proven. No user-visible change. Neon connection
   pooling can silently return unscoped rows if policies and the session role are
   not wired exactly right, so this is high-care, low-visibility work.
2. **DB-backed roles/capabilities** — move roles from the code map to data, with
   an admin UI to create/adjust/delete roles. Design already agreed: roles as
   data, capabilities as code, an undeletable admin role, and a
   delete-a-role-with-users guardrail. Deferred from v2 twice; do not start
   without an explicit go-ahead.

## New ideas

3. **"Awake past curfew" mechanic.** Today nothing penalises being active late at
   night, and it must stay that way for sleep: invariant 2 forbids ambient
   telemetry from affecting a fine, because otherwise the app rewards not opening
   the site. If a "you were clearly awake past curfew" consequence is ever wanted,
   it is a **separate activity type with its own evidence rule**, not a change to
   sleep. Its signal must come from an **explicit action** (a deliberate press,
   the same discipline as invariant 9), never from "user was seen at 3am" session
   or `last_seen` data. Open question if pursued: what explicit action could
   honestly stand in for "awake" without becoming ambient tracking. Likely hard to
   make fair, captured mainly so the reasoning is not lost.

4. **More transactional emails on more events.** v2 ships three (invite,
   approval decision, account-removed) through the `sendEmailBestEffort` +
   `mark()` layout in `src/server/email.ts`. Candidate further events, all
   driven by an explicit action or a committed state change, never ambient
   telemetry: invite accepted/declined (tell the inviter), shared-rules change
   (`config.shared.changed`, tell the group), a settlement recorded, a fine
   incurred for a missed period, and a role change. Constraints carry over from
   v2: each send is a side effect that never blocks or reverses the action and is
   recorded as an `email.*` event that scoring never reads (invariant 2); copy
   stays in the clerk voice. Watch total volume so Curfew does not become noisy;
   per-user email preferences may be needed before adding recurring or
   activity-driven mail. A weekly digest belongs here only if volume stays low
   and it is opt-out.
