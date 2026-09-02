import { z } from "zod";

// Fail loud at boot if anything is missing. See .env.example for where each
// value comes from.
//
// Connection strings: the app queries over the POOLED endpoint and migrations
// use the DIRECT one. Two names, no fallbacks and no aliases, because a
// connection string that resolves through three candidates is a connection
// string nobody can point at with certainty.
//
//   DATABASE_URL_POOLED   host contains -pooler, used by every request
//   DATABASE_URL_DIRECT   used by migrations only
//
// The values differ per environment, the names never do. Vercel Preview points
// them at the APAC project, Production at the old one until the cutover.

// A key present but empty means UNSET, not invalid. The three env files carry
// the same keys in the same order, so `.env.local` deliberately leaves R2 and
// Upstash blank rather than deleting the lines. Treating "" as a value would
// turn that convention into a boot failure.
const opt = (value: string | undefined) =>
  value && value.trim() !== "" ? value : undefined;

const raw = {
  DATABASE_URL_POOLED: opt(process.env.DATABASE_URL_POOLED),
  DATABASE_URL_DIRECT: opt(process.env.DATABASE_URL_DIRECT),
  BETTER_AUTH_SECRET: opt(process.env.BETTER_AUTH_SECRET),
  BETTER_AUTH_URL: opt(process.env.BETTER_AUTH_URL) ?? "http://localhost:3000",
  GOOGLE_CLIENT_ID: opt(process.env.GOOGLE_CLIENT_ID),
  GOOGLE_CLIENT_SECRET: opt(process.env.GOOGLE_CLIENT_SECRET),
  CRON_SECRET: opt(process.env.CRON_SECRET),
  RESEND_API_KEY: opt(process.env.RESEND_API_KEY),
  EMAIL_FROM: opt(process.env.EMAIL_FROM),

  // v3 services. Optional at boot on purpose: production still runs v2.5, which
  // uses neither, and local mode disables uploads and rate limiting entirely.
  // The modules that need them (src/server/r2.ts, src/server/ratelimit.ts)
  // check at first use and throw naming the key.
  R2_ACCOUNT_ID: opt(process.env.R2_ACCOUNT_ID),
  R2_ACCESS_KEY_ID: opt(process.env.R2_ACCESS_KEY_ID),
  R2_SECRET_ACCESS_KEY: opt(process.env.R2_SECRET_ACCESS_KEY),
  R2_BUCKET: opt(process.env.R2_BUCKET),
  R2_ENDPOINT: opt(process.env.R2_ENDPOINT),
  UPSTASH_REDIS_REST_URL: opt(process.env.UPSTASH_REDIS_REST_URL),
  UPSTASH_REDIS_REST_TOKEN: opt(process.env.UPSTASH_REDIS_REST_TOKEN),
};

const schema = z.object({
  DATABASE_URL_POOLED: z.string().url(),
  DATABASE_URL_DIRECT: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),

  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  R2_ENDPOINT: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

// Read an optional key that a v3 code path requires. Throws naming the key
// rather than failing later inside a signing routine or an HTTP call.
export function required(key: keyof typeof parsedData): string {
  const value = parsedData[key];
  if (!value) {
    throw new Error(`${key} is not set. See .env.example.`);
  }
  return value;
}

const parsed = schema.safeParse(raw);

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((i) => i.path.join("."))
    .join(", ");
  throw new Error(
    `Invalid or missing environment variables: ${missing}. Copy .env.example to .env.local and fill it in.`,
  );
}

const parsedData = parsed.data;

export const env = parsedData;
