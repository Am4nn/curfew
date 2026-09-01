import { DateTime } from "luxon";
import { previewEnabled } from "./preview";

// The single server-side "now". Everywhere the app asks the clock, it asks here.
// In production this is just `new Date()`. In preview mode a `mock_now` cookie
// (an ISO string, set by the preview bar) overrides it, so every time-derived
// screen can be scrubbed to any instant. next/headers is imported dynamically
// and guarded, so this is safe to call outside a request too (scripts, cron):
// it simply falls back to the real clock.
const COOKIE = "mock_now";

export async function now(): Promise<Date> {
  if (previewEnabled()) {
    try {
      const { cookies } = await import("next/headers");
      const value = (await cookies()).get(COOKIE)?.value;
      if (value) {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d;
      }
    } catch {
      // No request scope (a script or the cron job): use the real clock.
    }
  }
  return new Date();
}

// The same instant as a Luxon DateTime in UTC, for the many callers that start
// from `DateTime.utc()`.
export async function nowUTC(): Promise<DateTime> {
  return DateTime.fromJSDate(await now(), { zone: "utc" });
}

export const MOCK_NOW_COOKIE = COOKIE;
