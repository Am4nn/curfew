# ARCHITECTURE.md — How v3 is built

Server-side decisions, taken 2026-09-03. Companion to `CONFIG.md`, which covers
the registry, app settings and caching. The screen-by-screen contract is
`SCREENS.md`; the build order is `PLAN.md`.

## Runtime

Vercel, Neon, Cloudflare R2, Vercel Cron, Upstash Redis (decision 76). Nothing
new except R2 and Upstash. Better Auth stays, ids stay `text`, table names stay
plural, and the two Neon connection strings stay as they are: pooled for the
app, direct for migrations.

## Schema: evolve, and rewrite the engine on top

Data is a fresh start (decision 22), the schema is not (decision 69).

**Kept as they are**, because v1 got their shape right and it took a long time to
get right:

- `events` — the source of truth, append-only, namespaced types.
- `ledger_entries` — append-only, corrections are compensating rows.
- `users`, `groups`, `group_members`, `invites`.
- The effective-dated, insert-only config pattern.

**Reshaped:**

| Table | Change |
|---|---|
| `activity_types` | New. One row a module key, `enabled`, `effective_at`. See `CONFIG.md` |
| `app_settings` | New. Append-only, `effective_at`, one row a change |
| `user_activities` | Replaces per-user activity opt-in. Type key, enabled, effective-dated config as JSON validated by the module's schema |
| `activity_scores` | Gains the period unit and the schedule that produced it, so a weekly row is distinguishable from a daily one |
| `activity_outcomes` | Per group. Gains the settling flag, so a period inside the 7 days is scored but excluded from reputation |
| `group_activity_types` | New. Which types a group accepts, append-only |
| `group_settings` | New. Per-group overrides an admin sets, money first. Money is a property of a group, not of a group's relationship to one type, so it is not a column on `group_activity_types` |
| `notices`, `notice_acks` | New. What an admin announced and who acknowledged it. Acknowledging is final, so an ack row is the whole state |
| `group_shares` | New. Per member, per type: shared, and evidence shared |
| `reputation_daily` | New. One row a user a group a day, derived and rebuildable |
| `evidence` | New. Owner, activity, period, window, storage key, bytes, mime, `delete_after` |
| `notices` | New. What an admin announced, and who has acknowledged it |

**Rewritten from scratch:** `periodStart()`, the pass tests, the module
interface, the check-in state machine. These are the parts v3 outgrew.

## Activity modules: a declarative spec

A module is one file with no React in it (decision 73). It declares what the type
is; the engine renders every screen from that declaration and calls `evaluate` to
score a period (decision 78).

```ts
export const gym = {
  key: "gym",
  name: "Gym",
  description: "Sessions counted over a week",
  icon: "gym",
  defaults: {
    schedule: { kind: "minimum", perWeek: 3 },
    dayBoundary: "midnight",
    grace: 2,
    config: { ... },
  },
  configSchema: z.object({ ... }),
  evidenceSchema: z.object({ ... }),
  evidence: { level: "required", source: "live" },
  checkin: { kind: "tap" },
  chart: "weekly",
  steps(config, periodStart) { ... },
  windows(config, periodStart, timezone) { ... },
  evaluate(input) { return { passed, detail }; },
}
```

**Why `evaluate` and not a bare `pass(periods, config)`.** Scoring a period needs
the period's start, the user's timezone and the check-ins tagged by the step they
satisfied. Sleep judges three named windows, and windows are wall-clock times
that only resolve against a date and a zone. A signature without them forces the
engine to reconstruct windows it is not allowed to understand, which breaks
invariant 6. `evaluate` is also what lets `bun run verify` recompute a period
truthfully from events alone.

### What the engine owns, and what the module owns

Decision 79. The split is what keeps twelve modules from redeclaring the same
form.

| Owned by | Fields |
|---|---|
| **Engine** | `schedule` (named days, or a minimum a week), `dayBoundary`, `grace` |
| **Module** | windows, targets, thresholds and their direction, and anything else its `configSchema` declares |

The **period unit is derived**, never stored: a named-day schedule is judged by
the day, a minimum-a-week schedule by the week. Storing both invites a row that
says weekly and Mondays at once.

The engine draws the day picker with its ANY cell once, decides which days
produce periods, and applies grace, all without asking a module anything. A
module describes only what is specific to it.

`checkin.kind` is the whole UI contract. Five shapes cover the twelve types:

| Kind | Used by | What the engine draws |
|---|---|---|
| `tap` | Gym, Office | One button. Optional photo slot if the type asks for one |
| `counter` | Water | A +1 that repeats within the period, showing progress |
| `number` | Steps, Screen, Study, Reading | A numeric field against the target, with the rule's direction |
| `camera` | Food, Supplements, Sleep | The check-in page with a photo slot that blocks Send when required. Food's meal carries its calorie figure in the same check-in (decision 85) |
| `declare` | Nightfast, Sugar-free | Two answers: it held, or I slipped |

**Idempotency is a key the press carries** (decision 92). One check-in a period
was true when the app tracked only sleep; Water is eight glasses, Food is three
meals, Study and Reading add up sittings, and a declaration can be corrected. So
uniqueness in the database is on `(user, type, period, idem)`, where `idem` is
generated once per press. A retry or a replay carries the key it already used and
records nothing; a second deliberate press carries a new one and is kept. Steps
that must not repeat, like arriving at the office, declare `repeats: false` and
the write path refuses the second one.

A step also carries its own words (decision 90): the question a `declare` step
asks, the line under its fields, and what answering costs. One screen serves
twelve types, so anything on it specific to a type has to come from the type.

The engine consumes `{ passed, detail }` and never inspects `detail`
(invariant 6). Nothing outside a module knows what its type means, and no
`switch` on a type key exists outside the registry.

**The trade this makes:** a genuinely new check-in shape means extending the
engine, not just adding a module. That is the point. Twelve modules shipping
their own components is twelve places to drift from the mocks, and an outside
contributor writing UI that does not match the house style.

Stats charts follow the same rule: a module names its chart kind
(`windowed`, `numeric`, `weekly`, `binary`) and the engine draws it.

The configure screen works the same way. A module declares its **fields** as a
function of its config (decision 95), each naming a control the engine already
draws: a stepper, a typed box, a segmented switch, a time, or a time range. It
also declares the sentence under its evidence rule, any **fact** stated at the
top rather than offered as a control, its footnote, and a **validate** for
anything an object schema cannot express, reported against the field path that
is wrong so the screen can mark it in place.

The engine owns the day picker, grace, and "changes apply from tomorrow",
because those mean the same thing for every type.

## Scoring: nightly cron, lazy close on read

Decision 70.

**The job** runs nightly on Vercel Cron, as a route handler behind a secret:

1. Close every period that ended, per user, in the user's timezone.
2. Score it through the module's pass test, resolving config as it stood on that
   period (invariant 5).
3. Write `activity_scores`, then `activity_outcomes` per group, applying grace
   and fines.
4. Recompute `reputation_daily`.
5. Sweep evidence past its `delete_after`.

**The lazy path** exists so nothing is ever wrong because a job was late. Any
read that needs a period which has closed but is not yet scored closes it on the
spot, through the same function the cron calls. One implementation, two callers.

Both paths are idempotent: scoring a period twice produces the same rows.

## Reputation: nightly batch, replayable

Decision 72. One pass a night per user a group, appending a row a day to
`reputation_daily`. Rebuildable by replaying daily deltas from the join date,
checkpointed monthly as an optimisation and never as truth. `bun run verify`
recomputes a range and diffs it, exactly as it does for `activity_scores`.

The settling rule (decision 54) lives here: a period inside an activity's first
7 days is scored normally and excluded from the delta. Fines still apply.

## Evidence: presigned PUT straight to R2

Decision 71. No image ever passes through a serverless function.

1. The client compresses and strips EXIF in the browser, on a canvas re-encode.
   Longest edge capped, JPEG quality tuned to a few hundred KB.
2. It asks the server for an upload URL. The server writes an `evidence` row in
   `pending` state and returns a short-lived presigned PUT.
3. The browser PUTs the file directly to R2.
4. It calls back to confirm. The server marks the row `stored` and records the
   check-in event in the same transaction.

Consequences that matter:

- **The check-in is the callback, not the upload.** A file in R2 with no
  confirmed row is an orphan, swept by the nightly job. A check-in never exists
  without its photo.
- Reads are short-lived presigned GETs, issued only to the owner and to members
  of groups that member shares that activity's evidence with.
- R2 has no egress fees, which is the cost that grows with a group evidence view.

## Rate limiting

Upstash Redis (decision 75), a fixed window, on check-in writes and on
upload-URL requests. It fails open: losing a check-in because a rate limiter was
down would punish a user for our outage.

The check-in ceilings are **50 a period and 20 a minute**, per user per type
(decision 92). Both are abuse ceilings rather than quotas: fifty clears eight
glasses of water several times over, and twenty a minute stops a button that has
got stuck. Presigned URLs per user per hour is set in Phase 5.

## Validation and errors

Every input validates in place (decision 47). The rule is that validation lives
in the module's `configSchema` and in the domain, never only in the form, so the
server rejects what the client would have. A failed save returns which fields
failed and why, and the screen marks them where they are with Save disabled. The
mock board `V3CfgErrors` is the reference.

## Testing

- **Domain core under Vitest**, no database: pass tests per module, period
  boundaries, streak rules including the graced week, reputation deltas
  including the ceiling drift and the settling window.
- **`bun run verify`** extended to reputation, recomputing a range and diffing
  stored rows.
- **Preview mode** carries forward from v2.5: double-gated, mock clock, seeded
  data. It gains seed data for all twelve types so every screen in `SCREENS.md`
  can be opened without a real account.

## Not in v3

RLS stays deferred, so `assertMember()` in the query layer remains the only wall
(invariant 10). The security round after v3 must confirm it holds on every new
query in this document.
