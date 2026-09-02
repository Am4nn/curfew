import { z } from "zod";

// Fail loud at boot if anything is missing. See .env.example for where each
// value comes from.
//
// Connection strings: the app queries over the POOLED endpoint and migrations
// use the DIRECT one. v3 settles on one pair of names, DATABASE_URL_POOLED and
// DATABASE_URL_DIRECT, and Vercel already carries those. The older names stay
// as fallbacks so a local .env from before the rename still works:
//   pooled  <- DATABASE_URL_POOLED, else DATABASE_URL
//   direct  <- DATABASE_URL_DIRECT, else DIRECT_URL, else DATABASE_URL
const raw = {
  DATABASE_URL:
    process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL,
  DIRECT_URL:
    process.env.DATABASE_URL_DIRECT ??
    process.env.DIRECT_URL ??
    process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
};

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
});

const parsed = schema.safeParse(raw);

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((i) => i.path.join("."))
    .join(", ");
  throw new Error(
    `Invalid or missing environment variables: ${missing}. Copy .env.example to .env.local and fill it in.`,
  );
}

export const env = parsed.data;
