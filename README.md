<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/curfew-mark-dark.svg">
    <img alt="Curfew" src="docs/curfew-mark-light.svg" width="76" height="76">
  </picture>
</p>

<h1 align="center">Curfew</h1>

<p align="center">A group accountability contract engine for nightly sleep check-ins.<br>People form private groups, commit to a routine, and pay each other when they miss.</p>

---

See `.planning/PRD.md` for what and why, `.planning/PLAN.md` for build order,
`.planning/schema.sql` for the data model, and `CLAUDE.md` for the invariants
and voice.

Status: **v1 and v2 complete, deployed.**

## Stack

Next.js App Router + TypeScript, Tailwind, Better Auth (Google OAuth, database
sessions), Neon Postgres, Drizzle for typed queries only. Package manager: bun.
Migrations are plain numbered `.sql` files, not ORM-generated.

## First-time setup

1. **Install deps**

   ```
   bun install
   ```

2. **Neon** — create a project (region Singapore or Mumbai). Copy the pooled
   connection string (host contains `-pooler`) and the direct one.

3. **Google OAuth** — Google Cloud Console, new project, OAuth consent screen
   (External, Testing mode, scopes `email` and `profile` only, add yourself as a
   test user). Create a Web application OAuth client with redirect URI
   `http://localhost:3000/api/auth/callback/google`.

4. **Secrets**

   ```
   openssl rand -base64 32    # BETTER_AUTH_SECRET
   openssl rand -hex 32       # CRON_SECRET
   ```

5. **Env** — copy the template and fill every value.

   ```
   cp .env.example .env.local
   ```

6. **Migrate** — creates the auth tables then the app schema.

   ```
   bun run migrate
   ```

7. **Run**

   ```
   bun run dev
   ```

## Approve yourself

Nothing works until an admin approves your account. Sign in once with Google
(you will land on the pending screen), then run this against the database:

```sql
UPDATE user_approvals
   SET status = 'approved', is_admin = true, role = 'admin', decided_at = now()
 WHERE user_id = (SELECT id FROM users WHERE email = '125aryaaman@gmail.com');
```

Reload and you land on the empty dashboard. That is the Phase 0 "done when".

The app refuses to demote its last admin, so you cannot lock yourself out
through the UI. If the admin role is ever lost some other way (a direct DB
edit), the same statement above restores it.

## Commands

```
bun run dev         start the dev server
bun run build       production build
bun run typecheck   tsc --noEmit
bun run migrate     apply migrations/*.sql over DIRECT_URL
bun run auth:generate   regenerate Better Auth's table SQL (then reconcile)
bun run test        Vitest, the domain core
bun run verify      recompute a date range and diff the stored rows
```

## Preview mode (local, no sign-in)

A way to run the whole app against mock data with no Google sign-in, for UI/UX
work. It is double-gated (`NODE_ENV !== "production"` **and** `PREVIEW_MODE=1`),
so it can never run on Vercel, and it talks to a local Postgres, never Neon.

1. **Local Postgres** (Docker):

   ```
   docker run --name local-postgres -e POSTGRES_PASSWORD=<pw> -p 5432:5432 -d postgres
   ```

2. **Env** — copy the template and set the same password:

   ```
   cp .env.preview.example .env.preview
   ```

   This file is isolated from `.env.local` (loaded via dotenv-cli), and it sets
   the local DB for all three connection vars so preview cannot resolve to a
   real database.

3. **Migrate, seed, run**:

   ```
   bun install            # first time: pulls pg + dotenv-cli
   bun run preview:migrate
   bun run preview:seed   # wipes and rebuilds mock users, groups, check-ins, scores
   bun run preview:dev
   ```

Open http://localhost:3000 signed in as the seeded **Preview Admin**. The seed
covers approved/pending/removed users, multiple groups, an incoming invite,
streaks, fines and grace. Re-run `preview:seed` any time to reset.

A **PREVIEW** bar is pinned to the bottom of every page. It drives a mock clock
(a `mock_now` cookie the server reads instead of the real time), so you can
scrub to any instant and jump straight to the night / wake / confirm windows
(times are IST, the seeded user's timezone) to see every check-in state. "real
now" clears it.
