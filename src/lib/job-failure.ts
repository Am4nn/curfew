import { z } from "zod";

// QStash's failure report, and the row we keep of it.
//
// This lives in `lib` rather than in the route for the reason 3.4.6 bought:
// the route imports the database and the env, which `bun run test` has neither
// of, so a validator written there is a validator nothing can run. The push
// subscription schema moved out for the same reason after a `.strict()` object
// refused every Android phone for a week with nobody able to test it.

/**
 * What QStash POSTs to a failure callback. Every field optional on purpose.
 *
 * NOT `.strict()`. QStash owns this shape and adds fields to it, and refusing
 * an unrecognised one would turn a new field on their side into total silence
 * on ours, which is the exact failure this route exists to end.
 */
const jobFailure = z.object({
  status: z.number().optional(),
  url: z.string().optional(),
  method: z.string().optional(),
  retried: z.number().optional(),
  maxRetries: z.number().optional(),
  dlqId: z.string().optional(),
  sourceMessageId: z.string().optional(),
  scheduleId: z.string().optional(),
  /** The failing endpoint's response body, base64 encoded. */
  body: z.string().optional(),
});

export interface FailurePayload {
  path: string | null;
  url: string | null;
  status: number | null;
  retried: number | null;
  maxRetries: number | null;
  scheduleId: string | null;
  dlqId: string | null;
  sourceMessageId: string | null;
  response: string | null;
  /** False when the report did not match the schema and was kept anyway. */
  parsed: boolean;
}

/**
 * Turn a report into the event payload, and NEVER throw.
 *
 * An unparsable body still produces a row. Losing the alert because the report
 * about it was malformed would be the worst trade available here: the whole
 * point is that a failed job stops being invisible.
 */
export function describeFailure(raw: unknown): FailurePayload {
  const parsed = jobFailure.safeParse(raw);
  const r = parsed.success ? parsed.data : {};
  return {
    // The path rather than the whole URL, so production and dev rows read the
    // same and group together.
    path: pathOf(r.url),
    url: r.url ?? null,
    status: r.status ?? null,
    retried: r.retried ?? null,
    maxRetries: r.maxRetries ?? null,
    scheduleId: r.scheduleId ?? null,
    // The idempotency key: events_one_job_failure_idx is unique on it, so a
    // callback delivered twice records once. Also the handle for pulling the
    // message out of the dead letter queue within its three days.
    dlqId: r.dlqId ?? null,
    sourceMessageId: r.sourceMessageId ?? null,
    response: decode(r.body),
    parsed: parsed.success,
  };
}

function pathOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return url.slice(0, 200);
  }
}

/**
 * The dying route's own words, decoded and cut short.
 *
 * A Next.js error page is kilobytes of HTML and the useful part is at the top.
 * This is one line in an admin list, not an archive: the dlqId is how you get
 * the whole thing while QStash still has it.
 */
function decode(b64: string | undefined): string | null {
  if (!b64) return null;
  try {
    const text = Buffer.from(b64, "base64").toString("utf8").slice(0, 400);
    return text.trim() === "" ? null : text;
  } catch {
    return b64.slice(0, 400);
  }
}
