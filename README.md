<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/curfew-mark-dark.svg">
    <img alt="Curfew" src="docs/curfew-mark-light.svg" width="76" height="76">
  </picture>
</p>

<h1 align="center">Curfew</h1>

<p align="center">A habit tracker that asks for proof.<br>Twelve habits on your own schedule, photo evidence where one is worth having,<br>and private groups that see only what you choose to share.</p>

---

See `.planning/v3/SCOPE.md` for what and why, `.planning/v3/PLAN.md` for build
order, `.planning/schema.sql` for the data model, and `CLAUDE.md` for the
invariants and voice. `.planning/PRD.md` and `.planning/PLAN.md` are v1's, kept
for the reasoning behind the invariants and superseded on scope.

Status: **v3.0.0 deployed, 2026-09-15.** Production serves the latest version
tag, so `main` moving does not move the live site. Groups are invite-only and
there is no open signup, so a copy you run is a copy for you and the people you
invite.

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

Reload and you land on the empty dashboard.

The app refuses to demote its last admin, so you cannot lock yourself out
through the UI. If the admin role is ever lost some other way (a direct DB
edit), the same statement above restores it.

## Commands

```
bun run dev         dev server against .env.preview (the APAC database)
bun run local       dev server against .env.local (docker Postgres, mock data)
bun run build       production build
bun run typecheck   tsc --noEmit
bun run migrate     apply migrations/*.sql, then sync the activity registry
bun run auth:generate   regenerate Better Auth's table SQL (then reconcile)
bun run test        Vitest, the domain core
bun run lint        ESLint, type-aware, --max-warnings=0
bun run verify      recompute a date range and diff the stored rows
bun run browser     every screen and every form, against a running server
bun run check:signin  can a stranger see the sign-in page (needs a deployment)
bun run make:icons  home-screen icons and the iOS launch images
bun run fetch:font  vendor IBM Plex Mono into public/fonts
```

`CLAUDE.md` has the full list, including the narrow checks CI runs.

Three env files, all gitignored, all with the same keys in the same order:
`.env.local` (docker, mock data), `.env.preview` (`curfew-apac-dev`),
`.env.production` (`curfew-apac`, the live branch). `.env.example` is the key
list. Only the values differ, so a key must exist in all three.

**An environment file says nothing about what a deployment reads.** These are
read by the commands in this repo and by nothing else; what a deployment
connects to lives in Vercel, per environment. The two can disagree silently and
have.

## Local mode (no sign-in)

A way to run the whole app against mock data with no Google sign-in, for UI/UX
work. It is double-gated (`NODE_ENV !== "production"` **and** `LOCAL_MODE=1`),
so it can never run on Vercel, and it talks to a local Postgres, never Neon.

1. **Local Postgres** (Docker):

   ```
   docker run --name local-postgres -e POSTGRES_PASSWORD=<pw> -p 5432:5432 -d postgres
   ```

2. **Env** — copy the key list into `.env.local` and set the same password in
   both connection strings:

   ```
   cp .env.example .env.local
   ```

   Set `LOCAL_MODE=1`. Leave the R2 and Upstash values blank: uploads are
   disabled locally and the rate limiter is off.

3. **Migrate, seed, run**:

   ```
   bun install            # first time: pulls pg + dotenv-cli
   bun run local:migrate
   bun run local:seed     # wipes and rebuilds mock users, groups, check-ins, scores
   bun run local
   ```

Open http://localhost:3000 signed in as the seeded **Preview Admin**. The seed
covers approved/pending/removed users, multiple groups, an incoming invite,
streaks, fines and grace. Re-run `local:seed` any time to reset.

A **PREVIEW** bar is pinned to the bottom of every page. It drives a mock clock
(a `mock_now` cookie the server reads instead of the real time), so you can
scrub to any instant and jump straight to the night / wake / confirm windows
(times are IST, the seeded user's timezone) to see every check-in state. "real
now" clears it.

## Licence

[PolyForm Noncommercial 1.0.0](./LICENSE). Read it, fork it, change it, run
your own copy for yourself, and send a pull request. Using it for a commercial
purpose is not granted, which includes running it as a product or a service for
other people. See [CONTRIBUTING.md](./CONTRIBUTING.md).
