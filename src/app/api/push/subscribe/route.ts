import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getApprovalStatus } from "@/lib/session";
import { previewEnabled, PREVIEW_USER } from "@/lib/preview";
import { forget, remember } from "@/server/push";

// Remembering and forgetting a device.
//
// A route rather than a server action because the body is the browser's own
// `PushSubscription`, which arrives from `subscription.toJSON()` and is not a
// form. It does its OWN session and approval check: `src/middleware.ts`
// excludes the whole of `/api` from the sign-in gate, so nothing upstream has
// checked anything by the time this runs. Every route under `/api` repeats this
// for the same reason.

const subscription = z
  .object({
    endpoint: z.string().url().max(600),
    keys: z.object({
      p256dh: z.string().min(1).max(200),
      auth: z.string().min(1).max(200),
    }),
  })
  .strict();

const input = z.union([
  z.object({ action: z.literal("subscribe"), subscription }).strict(),
  // Unsubscribing needs only the address, since the keys are ours to look up
  // and nothing is encrypted on the way out.
  z.object({ action: z.literal("unsubscribe"), endpoint: z.string().url().max(600) })
    .strict(),
]);

export async function POST(request: Request) {
  let userId: string;
  if (previewEnabled()) {
    userId = PREVIEW_USER.id;
  } else {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }
    userId = session.user.id;
  }

  if ((await getApprovalStatus(userId)) !== "approved") {
    return NextResponse.json({ ok: false, reason: "not_approved" }, { status: 403 });
  }

  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  if (parsed.data.action === "subscribe") {
    await remember(userId, parsed.data.subscription);
  } else {
    await forget(userId, parsed.data.endpoint);
  }
  return NextResponse.json({ ok: true });
}
