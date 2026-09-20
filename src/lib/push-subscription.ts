import { z } from "zod";

/**
 * A browser's own `PushSubscription.toJSON()`, as posted to
 * /api/push/subscribe.
 *
 * It lives here rather than in the route so it can be tested. The route pulls
 * in auth and the database through its imports, and `bun run test` has neither,
 * so a schema defined there is a schema nothing can check.
 *
 * `expirationTime` is in the spec and Chrome sends it, as `null` in practice
 * because nothing expires these. Safari leaves it out entirely. So `.strict()`
 * accepted every iPhone and rejected every Android with a bare 400 `invalid`,
 * and the only place that showed was the network tab.
 *
 * Named and ignored rather than allowed through by dropping `.strict()`: a
 * subscription is a device address this app will later send to, and a field
 * arriving that nothing here has thought about should still be a refusal.
 */
export const pushSubscription = z
  .object({
    endpoint: z.string().url().max(600),
    expirationTime: z.number().nullish(),
    keys: z.object({
      p256dh: z.string().min(1).max(200),
      auth: z.string().min(1).max(200),
    }),
  })
  .strict();
