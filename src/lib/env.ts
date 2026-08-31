import { z } from "zod";

// Fail loud at boot if anything is missing. See .env.example for where each
// value comes from.
//
// Connection strings: the app queries over the POOLED endpoint and migrations
// use the DIRECT one. Neon's own env export names these DATABASE_URL_POOLED
// (pooled, host contains -pooler) and DATABASE_URL (direct), so both naming
// schemes are accepted:
//   pooled  <- DATABASE_URL_POOLED, else DATABASE_URL
//   direct  <- DIRECT_URL,          else DATABASE_URL
const raw = {
  DATABASE_URL:
    process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
};

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  CRON_SECRET: z.string().min(1),
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
