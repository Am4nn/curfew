# Curfew

A group accountability contract engine. See `.planning/PRD.md` for what and
why, `.planning/PLAN.md` for build order, `.planning/schema.sql` for the data
model, and `CLAUDE.md` for the invariants and voice.

Current phase: **Phase 0 — Scaffold.**

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
   SET status = 'approved', is_admin = true, decided_at = now()
 WHERE user_id = (SELECT id FROM users WHERE email = '125aryaaman@gmail.com');
```

Reload and you land on the empty dashboard. That is the Phase 0 "done when".

## Commands

```
bun run dev         start the dev server
bun run build       production build
bun run typecheck   tsc --noEmit
bun run migrate     apply migrations/*.sql over DIRECT_URL
bun run auth:generate   regenerate Better Auth's table SQL (then reconcile)
```

`test` and `verify` scripts arrive in Phase 1 and Phase 3.
