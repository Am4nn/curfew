# PLAN.md — building Curfew

Companion to `PRD.md` (what and why) and `schema.sql` (the data model).
This file is the build order.

**Read `PRD.md` and `schema.sql` before writing any code.** They contain
decisions with reasons; this file assumes them rather than repeating them.

---

## 0. What Aman has to do by hand

Claude Code cannot create accounts, click consent screens, or hold secrets.
These are yours. Each one blocks the phase named next to it.

### 0.1 Neon — blocks Phase 0

1. Sign up at neon.tech, create a project (region: Singapore or Mumbai, closest
   to both users).
2. From the connection details, copy **two** strings:
   - the **pooled** one (its host contains `-pooler`) → `DATABASE_URL`
   - the **direct** one → `DIRECT_URL`, used only by Drizzle migrations
3. Serverless functions open a connection per invocation. Application queries
   must use the pooled string. Getting these backwards produces connection
   exhaustion that only appears under load on Vercel, never locally.

### 0.2 Google OAuth — blocks Phase 0

1. Google Cloud Console → new project.
2. **OAuth consent screen** → External. Fill in app name and support email.
   Scopes: `email` and `profile` only. Nothing else — anything more triggers
   Google's verification review and you do not need it.
3. Leave it in **Testing** mode and add each real user as a test user. This
   suits an invite-only app: no verification, no public listing. (Testing mode
   expires Google *refresh* tokens after 7 days. That does not sign anyone out
   here — sessions are our own rows in Postgres, and we never call Google APIs
   after login.)
4. **Credentials** → Create OAuth client ID → Web application.
   Authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-domain>/api/auth/callback/google` (add when you deploy)
5. Hand back `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### 0.3 Vercel — blocks Phase 0 deploy

1. Import the repo. Framework preset: Next.js.
2. Add every env var below to Preview and Production.
3. Cron is configured in `vercel.json`, but read the constraints in PRD §6a
   before assuming a schedule will be honoured.

### 0.4 Secrets to generate yourself

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -hex 32      # CRON_SECRET
```

### 0.5 Environment variables

| Name | Where from | Notes |
|---|---|---|
| `DATABASE_URL` | Neon | **pooled** endpoint |
| `DIRECT_URL` | Neon | direct endpoint, migrations only |
| `BETTER_AUTH_SECRET` | generated | |
| `BETTER_AUTH_URL` | you | `http://localhost:3000` locally |
| `GOOGLE_CLIENT_ID` | Google Cloud | |
| `GOOGLE_CLIENT_SECRET` | Google Cloud | |
| `CRON_SECRET` | generated | Vercel sends it as `Authorization: Bearer` |

### 0.6 After the first sign-in — blocks everything

Nothing works until you approve yourself. Sign in once, then against the DB:

```sql
UPDATE user_approvals
   SET status = 'approved', is_admin = true, decided_at = now()
 WHERE user_id = (SELECT id FROM users WHERE email = 'you@example.com');
```

Chicken-and-egg by design: there is no self-serve path to admin.

### 0.7 Not needed, deliberately

No payment provider. No email provider in v1 (invites appear on the invitee's
dashboard; add email in v2 if it turns out you need it). No analytics. No error
tracker until something is actually running.

---

## 1. Standing rules for every phase

These are the invariants that make the design work. Breaking one is a bug even
if tests pass.

1. `events` is the only source of truth. `activity_scores`, `activity_outcomes`
   and every view are rebuildable from it.
2. Scoring reads **only** `checkin.*` events. Never sessions, never
   `last_seen`, never login events. Ambient telemetry must not affect a fine.
3. `ledger_entries` is append-only. No `UPDATE`, no `DELETE`. Corrections are
   compensating rows.
4. Config is insert-only with a **future** `effective_from`. The app rejects
   `effective_from <= CURRENT_DATE`; the DB does not enforce this.
5. Every computation resolves config as it stood on that period's start, never
   as it stands now. See the immutability block in `schema.sql`.
6. Nothing outside an activity module knows what "sleep" means. The engine
   consumes `{ passed, detail }` and never inspects `detail`.
7. Money is integer minor units plus a separate currency code. Never float. The
   decimal exponent comes from the currency, never a hardcoded `/100`.
8. Server timestamps only. Client clocks are editable.
9. Membership is enforced in the query layer via one `assertMember()` helper,
   on every query. RLS is deferred, not a substitute.

**Review gate:** phases 0–3 are reviewed diff by diff. Phases 4–6 can run
autonomously. The split is deliberate — a silent bug in period resolution or
scoring produces wrong fines for weeks before anyone notices, whereas the
ledger and group CRUD fail loudly.

---

## Phase 0 — Scaffold

Next.js App Router + TypeScript. Tailwind with the tokens from
`curfew-ui.html` (`--dim` is `#5A5751`, not the earlier value). Drizzle with
schema derived from `schema.sql` — hand-write it, do not let Drizzle invent the
model. Better Auth with the Google provider, **database** session strategy,
plural `modelName`s, ids as `text`.

Approval middleware: an authenticated user whose `user_approvals.status` is not
`approved` sees the pending screen and nothing else — no groups, no invites, no
API access.

**Done when:** you sign in with Google, land on the pending screen, approve
yourself with the SQL above, and land on an empty dashboard.

**Watch for:** Better Auth's default singular `modelName` creates a table called
`user`, a reserved word. Plural names are configured up front or you quote it
forever.

---

## Phase 1 — Domain core (no database)

Pure functions, unit tested, zero DB access. This is where the real bugs are.

- `ActivityType` interface and registry (PRD §6).
- The `sleep` module: `userConfigSchema`, `evidenceSchema`, `steps()`,
  `evaluate()`. Only module aware of night/wake/confirm.
- `periodStart(instant, timezone, period)` — noon-to-noon for daily. A 00:30
  check-in belongs to the previous night.
- `resolveConfig(scope, key, periodStart)` — the effective-dated lookup.
- `splitFine(amount, recipientIds)` — equal split, remainder distributed one
  minor unit at a time, recipients ordered by id. Must sum exactly.

**Vitest, required:**

```
periodStart('2026-08-31T23:30', 'Asia/Kolkata') === '2026-08-31'
periodStart('2026-09-01T00:30', 'Asia/Kolkata') === '2026-08-31'  // the one that breaks
periodStart('2026-09-01T13:00', 'Asia/Kolkata') === '2026-09-01'
```

Plus: month-end on a 31-day month, on a 30-day month, and Feb 28/29 (2028).
Plus: the same instant resolving to different dates for IST and London users.
Plus: `splitFine(5000, [a,b,c])` → `[1667,1667,1666]`, summing to 5000.
Plus: config resolution returning the old row for a past date after a new row
is inserted.

**Done when:** Vitest green and no import of the DB layer anywhere in this
directory.

---

## Phase 2 — Check-in loop

The one route that matters. Server computes which window is open from the
user's resolved config; the page renders exactly one action.

- `POST /api/checkin` — server-stamped, writes one `events` row. Rejects
  outside the window, rejects duplicates via the partial unique index.
- `/` renders night / morning / idle / already-checked-in states.
- A check-in is an **explicit button press**. Never on page load — PRD §6b
  explains why, and it is not negotiable: prefetch and link previews fire GETs.
- Auto-create one group and one sleep activity for a new user so the loop works
  before Phase 5 exists.

**Done when:** you and your friend check in for three real nights and the
events table looks right.

---

## Phase 3 — Scoring

- Job resolves, per user, every **unscored** period from `MAX(period_start)` up
  to the last closed one. Not literally yesterday: Vercel Hobby cron is
  best-effort and a skipped run must not lose a night.
- Writes `activity_scores` (once per user per type per period), then
  `activity_outcomes` (once per group activity) with streak, grace, fine.
- Idempotent: `ON CONFLICT DO UPDATE`. Safe to run twice. `--from-date`
  backfill flag.
- Streak: recompute the full chain per user per activity each run. At this
  scale it is microseconds. Do not get clever with incremental state.
- Grace: 2 per calendar month, `date_trunc('month', period_start)` — anchored
  to the period, **not** to `now()`, or the boundary gifts extra grace.
- Verdicts are computed on read between window close and the cron run, so the
  morning screen is truthful before anything is persisted. Cron only writes.
- `GET /api/cron/score` verifies the `Authorization: Bearer $CRON_SECRET`
  header. Without this, the public URL triggers scoring for anyone.
- `/verify` recomputes a date range from events and diffs against stored rows.
  It **must** use the same effective-dated lookups or it reports all history as
  drift after any config change.

**Vitest:** streak chain across a grace-absorbed miss; grace exhaustion; month
boundary; a config change mid-range leaving earlier periods untouched.

**Done when:** a month of backfilled data produces zero drift from `/verify`.

**Review gate ends here.**

---

## Phase 4 — Money

- Failed period → one ledger row per other **active** member, using
  `splitFine`. `group_members.joined_at` / `left_at` gate who counts.
- `balances` view per group per currency.
- Settlement writes a row; never mutates.
- Activity feed rendered from the ledger, newest first.
- **A ₹0 balance is not "nothing happened."** When two members both fail, rows
  net to zero but both lost the period. The UI shows the default separately
  from the money.

---

## Phase 5 — Groups

Create, invite by email, accept/decline, leave (balance survives), admin
approvals screen, multi-group dashboard as landing page.

No join links. No discoverable groups. An invite exists only because an owner
typed an email.

**Done when:** a second group works without touching any Phase 1–4 code. If it
does not, the abstraction is wrong and that is worth knowing now.

---

## Phase 6 — Polish

Settings screens for both config scopes, with shared changes clearly marked as
affecting everyone from tomorrow. The 30-day wake time chart. Empty states.

---

## Explicitly not in v1

Do not build these, even if they seem easy while you are in the area:

- Any activity type other than sleep. The abstraction exists so the *second*
  type is cheap later, not so you add it now.
- Push notifications. Web push on iOS needs an installed PWA and is unreliable.
- Any payment integration. See PRD §8 — this is a legal constraint.
- Multiple leaderboards or rankings. One score.
- Retention or archival policy. ~18k rows/year is nothing.
- Email sending.
- RLS. Query-layer scoping first; prove it, then add RLS as depth.

---

## Still open

- Deploy timing: Phase 0 is recommended — pooled connections, cron auth and
  cold starts only misbehave on Vercel, and finding that in Phase 5 is far
  worse than in Phase 0.
- Grace defaults to 2 and is configurable. Set it to 0 from settings if it
  turns out to be a loophole rather than a safety valve.
