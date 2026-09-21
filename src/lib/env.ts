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
  // uses neither, and local mode does not rate limit. Uploads DO run locally:
  // src/server/r2.ts swaps the bucket for a directory under LOCAL_MODE rather
  // than failing, so the evidence path is exercised without credentials. The
  // modules that need these check at first use and throw naming the key.
  R2_ACCOUNT_ID: opt(process.env.R2_ACCOUNT_ID),
  R2_ACCESS_KEY_ID: opt(process.env.R2_ACCESS_KEY_ID),
  R2_SECRET_ACCESS_KEY: opt(process.env.R2_SECRET_ACCESS_KEY),
  R2_BUCKET: opt(process.env.R2_BUCKET),
  R2_ENDPOINT: opt(process.env.R2_ENDPOINT),
  UPSTASH_REDIS_REST_URL: opt(process.env.UPSTASH_REDIS_REST_URL),
  UPSTASH_REDIS_REST_TOKEN: opt(process.env.UPSTASH_REDIS_REST_TOKEN),
  QSTASH_URL: opt(process.env.QSTASH_URL),
  QSTASH_TOKEN: opt(process.env.QSTASH_TOKEN),

  // Web Push. Optional for the same reason as R2: nothing boots that needs
  // them, and the two modules that do check at first use and throw naming the
  // key.
  VAPID_PUBLIC_KEY: opt(process.env.VAPID_PUBLIC_KEY),
  VAPID_PRIVATE_KEY: opt(process.env.VAPID_PRIVATE_KEY),
  VAPID_SUBJECT: opt(process.env.VAPID_SUBJECT),

  // The one key in this file whose ABSENCE is a meaningful, safe answer rather
  // than a misconfiguration. Everything above refuses to work without a value
  // because guessing gives you a broken page. Guessing here gives somebody a
  // notification nobody meant to send, so unset means off and only production
  // sets it. Compared as a string, not coerced: "0", "false" and "" all have to
  // mean off, and Boolean("0") does not.
  PUSH_REMINDERS: opt(process.env.PUSH_REMINDERS),

  // The coach. All optional, and COACH_ENABLED unset means OFF, which is
  // PUSH_REMINDERS' rule for the same reason: the cost of guessing here is a
  // paid call to another company made by an environment nobody meant to enable.
  //
  // The provider is a value rather than a build-time choice (1.21), so swapping
  // Gemini for DeepSeek is an env change and a redeploy, never a code edit.
  COACH_ENABLED: opt(process.env.COACH_ENABLED),
  COACH_PROVIDER: opt(process.env.COACH_PROVIDER),
  COACH_MODEL: opt(process.env.COACH_MODEL),
  COACH_API_KEY: opt(process.env.COACH_API_KEY),
  COACH_DAILY_ASKS: opt(process.env.COACH_DAILY_ASKS),
  COACH_MONTHLY_CEILING: opt(process.env.COACH_MONTHLY_CEILING),
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
  QSTASH_URL: z.string().url().optional(),
  QSTASH_TOKEN: z.string().min(1).optional(),

  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),

  PUSH_REMINDERS: z.string().optional(),

  COACH_ENABLED: z.string().optional(),
  COACH_PROVIDER: z.enum(["gemini", "deepseek", "stub"]).optional(),
  COACH_MODEL: z.string().optional(),
  COACH_API_KEY: z.string().optional(),
  // Both are read as numbers where they are used, never here: a malformed
  // number should refuse one call, not refuse to boot the app.
  COACH_DAILY_ASKS: z.string().optional(),
  COACH_MONTHLY_CEILING: z.string().optional(),
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
