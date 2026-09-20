import { describe, it, expect } from "vitest";
import { pushSubscription as subscription } from "@/lib/push-subscription";

// The shape a browser actually posts. Chrome and Safari disagree about one
// field and the disagreement cost every Android user notifications: `.strict()`
// refused `expirationTime`, the route answered a bare 400 `invalid`, and
// nothing anywhere said which key was wrong.
const KEYS = {
  p256dh:
    "BHKGaC395ziFijcIg3yl6-0Ha7RYWVympLlRfk2bRW4ffJ76LJTWPJhQ6PqBPjLhQF_jP4gJjhlkw-cL1qJfyDA",
  auth: "TZrtTQPgFCcwUcTSkaWSdQ",
};

describe("what a browser posts to /api/push/subscribe", () => {
  it("takes Chrome, which sends expirationTime", () => {
    const r = subscription.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/dA1GoUATtk4",
      expirationTime: null,
      keys: KEYS,
    });
    expect(r.success).toBe(true);
  });

  it("takes Safari, which does not", () => {
    const r = subscription.safeParse({
      endpoint: "https://web.push.apple.com/QGe4W1",
      keys: KEYS,
    });
    expect(r.success).toBe(true);
  });

  it("takes an expiry that is actually a number", () => {
    const r = subscription.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/dA1GoUATtk4",
      expirationTime: 1790000000000,
      keys: KEYS,
    });
    expect(r.success).toBe(true);
  });

  it("still refuses a field nothing here has thought about", () => {
    const r = subscription.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/dA1GoUATtk4",
      keys: KEYS,
      somethingNew: "?",
    });
    expect(r.success).toBe(false);
  });

  it("still refuses a subscription with no keys", () => {
    const r = subscription.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/dA1GoUATtk4",
    });
    expect(r.success).toBe(false);
  });
});
