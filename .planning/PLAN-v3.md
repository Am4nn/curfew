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
