import { and, eq, inArray } from "drizzle-orm";
import webpush, { WebPushError } from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { env, required } from "@/lib/env";

// Getting a notification onto a phone.
//
// The shape is not what most people expect: the server never talks to the
// device. The browser subscribes, its vendor's push service hands back an
// endpoint URL, and that URL is the device's address. We POST an encrypted
// payload to it, signed with our VAPID key, and Apple or Google delivers it
// over the one socket the operating system already holds open. There is no
// webhook on the client and no connection to keep alive here.
//
// Which means the subscription row is the ONLY way to reach somebody, and the
// only way to learn we no longer can is a 404 or 410 from the push service.
// `deliver` deletes on both, and that is not cleanup. iOS expires subscriptions
// without telling anybody, so a row that is never pruned is a row we keep
// failing to send to forever.

/** One notification, ready to encrypt. */
export interface Payload {
  title: string;
  body: string;
  /** Where tapping it goes. Absolute, because the service worker has no base. */
  navigate: string;
  /** The number on the home-screen icon. 0 clears it. */
  badge: number;
  /**
   * Seconds the push service should hold this if the device is offline.
   *
   * It matters more here than in most apps. A last call that arrives after the
   * window shut is worse than silence: it names a deadline that has passed and
   * asks for something that can no longer be recorded.
   */
  ttlSeconds: number;
}

/**
 * The wire format is Declarative Web Push, and that is the one trick worth
 * taking in this whole feature.
 *
 * Safari understands this JSON natively. An immutable payload is rendered by
 * the platform itself and the badge is set from `app_badge`, with no service
 * worker involved and none required. Chrome does not implement the format at
 * all, so the bytes arrive at the service worker untouched, where `sw.js`
 * parses the same JSON and calls showNotification and setAppBadge by hand.
 *
 * One payload, both platforms, and no double notification: the reason Safari
 * does not ALSO run the worker is precisely that the payload is immutable.
 * Setting `mutable: true` here would produce two notifications on iOS.
 */
function body(p: Payload): string {
  return JSON.stringify({
    web_push: 8030,
    notification: {
      title: p.title,
      body: p.body,
      navigate: p.navigate,
    },
    app_badge: p.badge,
  });
}

function configure(): void {
  webpush.setVapidDetails(
    required("VAPID_SUBJECT"),
    required("VAPID_PUBLIC_KEY"),
    required("VAPID_PRIVATE_KEY"),
  );
}

/** Is push configured at all? Screens ask before offering the switch. */
export function pushConfigured(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

/** The key the browser needs to subscribe. Public by design. */
export function publicKey(): string {
  return required("VAPID_PUBLIC_KEY");
}

export interface Delivery {
  sent: number;
  /** Devices that answered 404 or 410 and have been forgotten. */
  gone: number;
  failed: number;
}

/**
 * Send one notification to every device this member has.
 *
 * Every device, because a subscription is per browser on per machine: a phone
 * and a laptop are two rows and both should buzz. Nothing here batches across
 * members, since each payload is encrypted against that device's own keys.
 */
export async function deliver(userId: string, payload: Payload): Promise<Delivery> {
  const devices = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  if (devices.length === 0) return { sent: 0, gone: 0, failed: 0 };

  configure();
  const encoded = body(payload);
  const stale: string[] = [];
  const ok: string[] = [];
  let failed = 0;

  for (const device of devices) {
    try {
      await webpush.sendNotification(
        {
          endpoint: device.endpoint,
          keys: { p256dh: device.p256dh, auth: device.auth },
        },
        encoded,
        {
          TTL: payload.ttlSeconds,
          // Delivery under battery saving, not prominence. There is no way to
          // mark a web push Time Sensitive: interruption-level is an APNs field
          // available to native apps only, and the declarative payload carries
          // no priority of any kind. That gap is recorded in ROADMAP theme 4
          // and it is the strongest single argument there for a native app.
          urgency: "normal",
        },
      );
      ok.push(device.endpoint);
    } catch (e) {
      // 404 and 410 are the push service saying this device is gone. Every
      // other status is ours to fix and the row stays.
      if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) {
        stale.push(device.endpoint);
      } else {
        failed++;
      }
    }
  }

  if (stale.length > 0) {
    await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.endpoint, stale));
  }
  if (ok.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ lastOkAt: new Date() })
      .where(inArray(pushSubscriptions.endpoint, ok));
  }

  return { sent: ok.length, gone: stale.length, failed };
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Remember a device, or re-remember one.
 *
 * The upsert is not an optimisation. iOS expires a subscription silently, so
 * the client re-subscribes on every launch, and the push service hands back the
 * same endpoint when nothing has changed. Inserting would accumulate a row a
 * day per device; conflicting on the endpoint means a launch costs nothing.
 *
 * The user id is in the SET clause on purpose. Two accounts on one browser is
 * rare and real, and the endpoint belongs to whoever subscribed last, or the
 * second person's notifications go to the first person's row.
 */
export async function remember(userId: string, sub: Subscription): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({
      endpoint: sub.endpoint,
      userId,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
}

/** Forget one device. This is what turning notifications off means. */
export async function forget(userId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        // Scoped to the owner so an endpoint alone cannot unsubscribe somebody
        // else. The endpoint is not a secret: it travels in every payload we
        // send and sits in the browser's own storage.
        eq(pushSubscriptions.userId, userId),
      ),
    );
}

/** How many devices this member has. The settings screen says so. */
export async function deviceCount(userId: string): Promise<number> {
  const rows = await db
    .select({ endpoint: pushSubscriptions.endpoint })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return rows.length;
}
