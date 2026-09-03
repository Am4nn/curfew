import { required } from "@/lib/env";

// Rate limiting over Upstash Redis (decision 75), on the check-in write path
// and on upload-URL requests. REST rather than the Redis protocol, because a
// serverless function has nowhere to keep a connection pool.
//
// A fixed window, not a sliding one. The limits here are abuse ceilings, not
// quotas anyone should ever meet, and a fixed window is one round trip: INCR
// the counter, EXPIRE it on the first hit. A sliding window costs a sorted set
// and several commands to save an accuracy nobody is measuring.


/**
 * Count one hit against `key` and say whether it is allowed.
 *
 * Fails OPEN. If Upstash is unreachable the check-in still records: losing a
 * check-in because a rate limiter was down would punish a user for our outage,
 * and every write path behind this is already authenticated and idempotent.
 */
export async function rateLimit(options: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ ok: boolean; remaining: number }> {
  const { key, limit, windowSeconds } = options;
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const counter = `rl:${key}:${window}`;

  try {
    // Inside the try: an unconfigured environment (a local database, a script)
    // fails open like an unreachable one rather than refusing every write.
    const url = required("UPSTASH_REDIS_REST_URL");
    const token = required("UPSTASH_REDIS_REST_TOKEN");
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", counter],
        ["EXPIRE", counter, String(windowSeconds), "NX"],
      ]),
      cache: "no-store",
    });
    if (!response.ok) return { ok: true, remaining: limit };

    const results = (await response.json()) as Array<{ result?: number }>;
    const count = Number(results[0]?.result ?? 0);
    return { ok: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    return { ok: true, remaining: limit };
  }
}
