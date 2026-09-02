// Local mode: a sign-in-free way to exercise every app state with mock data
// against a local Postgres. Double-gated so it can never run in production:
// NODE_ENV must not be "production" AND LOCAL_MODE must be "1" (a var that only
// ever lives in .env.local). On Vercel NODE_ENV is "production", so even a
// leaked flag stays inert.
//
// The flag is LOCAL_MODE, not PREVIEW_MODE, because "preview" now means the
// Vercel Preview environment, which is a real deployment against the APAC
// database with real sign-in. The two are opposites and must not share a word.
// The function keeps its name; only the env var is the one people read.
//
// This module is pure (no next/headers, no db) so it is safe to import from the
// db layer and from scripts.
export function previewEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.LOCAL_MODE === "1";
}

// The fixed identity returned by getSessionUser() in preview mode. Its id must
// match the row the seed script writes (users + an approved admin approval), so
// every real query downstream (approval, role, membership) just works.
export const PREVIEW_USER = {
  id: "preview-admin",
  name: "Preview Admin",
  email: "preview@curfew.local",
  image: null as string | null,
};
