# SETUP.md — What to create before Phase 1

Everything here is account work only you can do. Each block says what to create,
what to send back, and what I do with it. Nothing in the repo needs to change
until the values exist.

## 1. Neon, in APAC

A new Neon project, replacing the current one. Do not touch the existing project
yet: production still runs on it.

- **Region: Singapore (`ap-southeast-1`)** unless Neon now offers something
  closer to India, in which case take the closer one. Neon has no Mumbai region
  at the time of writing.
- Name it something that will not be confused with the old one, for example
  `curfew-apac`.
- Take **both** connection strings from the dashboard:
  - the **pooled** one, whose host contains `-pooler`,
  - the **direct** one, for migrations.

**Send me:** `DATABASE_URL_POOLED` (pooled), `DATABASE_URL_DIRECT` (direct).

**The gotcha worth naming.** Moving the database to Singapore only helps if the
app moves with it. A Vercel function in Washington talking to a database in
Singapore is slower than both being in the US. So Vercel's function region must
change to `sin1` at the same time, otherwise this is a downgrade. I add that to
`vercel.json`.

**Cutover.** Develop v3 against the new project, leave production pointing at
the old one until v3 ships. Switching production's `DATABASE_URL_POOLED` today would
point the live v2.5 app at an empty database and break it for everyone using it
now. When v3 ships, production moves and the old project is deleted after a
week of nobody complaining.

## 2. Cloudflare R2

- Create an R2 bucket, **`curfew-evidence`**. Region hint: APAC.
- Create a second, **`curfew-evidence-dev`**, for preview and local work. Photos
  in development should never share a bucket with real ones.
- **Do not enable public access.** Every read is a short-lived presigned GET.
- Create an **R2 API token** with Object Read and Write, scoped to those two
  buckets only. Cloudflare shows the access key id and secret **once**.
- Note the **account id** from the R2 page. The S3 endpoint is
  `https://<account-id>.r2.cloudflarestorage.com`.

**Send me:** account id, access key id, secret access key, and confirmation of
both bucket names.

**CORS.** A presigned PUT from a phone browser is a cross-origin request, so
each bucket needs this. R2 dashboard, bucket, Settings, CORS policy:

```json
[
  {
    "AllowedOrigins": [
      "https://curfew.amanarya.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type", "content-length"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add the Vercel preview domain to `AllowedOrigins` if you want uploads working on
preview deploys. Everything else stays closed.

## 3. Upstash Redis

- Create a Redis database, **region Singapore** to match the app and the
  database. A rate limiter that costs a trans-Pacific round trip defeats itself.
- The free tier is enough: rate limiting is a few writes a check-in.
- Take the **REST** credentials, not the Redis protocol ones. The REST API is
  what works from a serverless function without a connection pool.

**Send me:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

## 4. Vercel

Once the values above exist:

- Add every new variable to **Production, Preview and Development**.
- The database names are the same everywhere: `DATABASE_URL_POOLED` and
  `DATABASE_URL_DIRECT`. Only the value changes. Point **Production** at the old
  project and **Preview and Development** at the APAC one. That is the safe
  order, and the cutover is then an edit to two values in one environment.
- `CRON_SECRET` already exists. Keep it.

I add the region and the cron schedule to `vercel.json`.

## What lands in the environment

`.env.example` carries the full list. New in v3:

```
DATABASE_URL_POOLED=
DATABASE_URL_DIRECT=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=curfew-evidence
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Three env files carry these keys, all gitignored, all in the same order:
`.env.local` (docker Postgres, `LOCAL_MODE=1`, blank R2 and Upstash),
`.env.preview` (the APAC project, `curfew-evidence-dev`) and `.env.production`
(the live project, `curfew-evidence`). Only values differ.

## What I do once the values arrive

1. Update `.env.example`, the single key list behind all three env files.
2. `vercel.json`: `regions: ["sin1"]`, and the nightly cron hitting the scoring
   route behind `CRON_SECRET`.
3. `bun run migrate` against the new project, from an empty database, to prove
   the numbered migrations still apply cleanly in order.
4. Wire the R2 client and the Upstash limiter as thin modules with no callers,
   so Phase 5 and Phase 4 have something to import.

## Never commit

`.env.local` and `.env.preview` are gitignored and hold live secrets. The R2
secret access key is shown once by Cloudflare and cannot be read back, so put it
in the password manager before pasting it anywhere.
