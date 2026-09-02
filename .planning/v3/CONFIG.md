# CONFIG.md — The registry, app settings, and how they are read fast

Two things decide what the app offers: the **module registry** in code, and a
small amount of **operational state** in the database. This file says which is
which, how they stay in sync, and how they are read without costing a query on
every page.

## The registry is code, the row is state

**A module is what a type is.** Key, name, one-line description, icon, default
config, pass test, evidence rule. One file per type, collected by a registry.
None of that goes in the database. Two definitions can disagree; one cannot.

**A row is whether a type is available.** That is the only thing an admin
changes at runtime, so that is the only thing stored.

```
activity_types
  type_key      text        -- matches the module's key exactly
  enabled       boolean
  effective_at  timestamptz
  changed_by    text
  created_at    timestamptz
```

**A type is offered only when it has a row and that row is enabled.** No row
means the module exists in code but has never been reconciled, and the catalog
must not show it. This is deliberate: a half-finished module in a branch cannot
reach anyone.

## Keeping them in sync

`bun run sync:activities` reads the registry and inserts a row for every module
key that has none, **disabled** (decision 63). It runs as part of
`bun run migrate`, so the existing workflow already covers it.

- `--check` exits non-zero when a module has no row.

**What `--check` proves, and where.** CI runs it against a throwaway Postgres,
after migrating from empty and running the sync. That proves the sync reconciles
every registered module: a malformed key, a duplicate, or a module the registry
never collects fails the build. It cannot prove the *deployed* database is in
sync, because a fresh database has no rows until CI's own sync writes them. The
deployment guard is the same command run against the real database after a
deploy, where a module that shipped without a migrate run does exit non-zero.
- It never deletes. A module removed from code leaves its row behind, because
  users may still have history against it.
- No annotation, no decorator, no startup hook. The registry already knows every
  module; the script only reconciles. A startup sync would be wrong here anyway:
  serverless has no reliable boot hook, so it would write on a read path on
  every cold start.

**New types ship dark.** A contributor adds one file, runs migrate, and their
type appears in admin Controls switched off, waiting for a human. That is a free
rollout gate.

## App settings

The same shape, for the switches in admin Controls (decision 64):

```
app_settings
  key           text        -- money, photo_evidence, new_groups, invites,
                            -- signups, retention_days
  value         jsonb
  effective_at  timestamptz
  changed_by    text
  created_at    timestamptz
```

Append-only. A change is a new row, never an update. Two reasons, and the first
is not optional:

1. **Decision 59 requires it.** Every calculation resolves the state as it stood
   on the period being scored. A mutable boolean destroys the ability to answer
   "was money on last Tuesday", and `bun run verify` would report every past
   period as drift the first time anyone toggled anything.
2. The audit trail comes free, and the admin console wants it.

### Immediate, and what that does to invariant 4

**Admin switches take effect immediately** (decision 65). That is why the column
is `effective_at timestamptz` and not `effective_from date`.

This is a deliberate carve-out from invariant 4, which says config is
insert-only with a **future** `effective_from`. The carve-out is narrow and the
distinction is real:

- **Invariant 4 governs scoring config**: a user's windows and targets, a
  group's fines and grace. Changing those mid-period would rewrite how a period
  in progress is judged, so they stay future-dated. Unchanged.
- **App settings are operational**: they switch a system on or off for everyone.
  They are still append-only and still resolved as-of, so history is intact.
  They simply take effect at the moment they are written.

Amend the invariant 4 wording in `CLAUDE.md` to name scoring config explicitly,
rather than leaving app settings looking like a violation.

### Periods that straddle a switch

One rule, because "immediate" needs one: **a period is judged against the
settings as they stood at the moment the period closed.**

Money switched off at 3pm and the day closes at midnight: that day carries no
fine. Switched back on at 9am the next day and that day does. One lookup at
scoring time, no partial periods, no arithmetic about fractions of a day.

## Money resolution order

Money is now settable in three places, so the order is fixed (decision 66):

1. **App-wide** `money` in `app_settings` sets the default.
2. **A per-group override** set by an admin in the Groups tab wins for that
   group. This is how a single group keeps money while it is off everywhere
   else.
3. **The group owner's own toggle** decides within what the first two allow. An
   owner can never turn money on where an admin has it off.

**A user sees money if any group they belong to has it on.** Otherwise the word
never appears: no balances on Home, no ledger, no fines in group settings, no
mention on any screen (decision 43). Turning it off app-wide with no group
overrides makes Curfew a habit tracker with no money in it at all.

## Reading it fast

Config is read on nearly every request and changes a few times a year. It must
never cost a round trip on a hot path.

**One cached read for all of it.** A single function returns the whole
resolved config, the enabled type list and every app setting, wrapped in
`unstable_cache` under the tag `app-config` with a 60 second TTL.

- **Admin saves call `revalidateTag("app-config")`.** That is what makes
  "immediate" true without polling. The TTL is only a safety net for a
  revalidation that failed to land.
- One query, not one per setting. The table is a few dozen rows; read the lot
  and resolve in memory.
- **Scoring does not use the cache.** It resolves as-of the period being scored,
  reading history directly. The cache serves the interface, where only "now"
  matters.
- The catalog page, the check-in path and the group screens all read the same
  cached object, so enabling a feature costs nothing on the pages that do not
  use it.

Full SSG or ISR is the wrong tool: these pages are per-user and already dynamic.
The cost worth removing is the config query, and a tagged cache removes it
without changing how any page renders.
