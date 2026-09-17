import { NextRequest, NextResponse } from "next/server";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions, userApprovals } from "@/db/schema";
import { env } from "@/lib/env";
import { now } from "@/lib/clock";
import { recordEvent } from "@/server/events";
import { deliver, pushConfigured } from "@/server/push";
import { nextFor } from "@/server/notification-kinds";

// The tick. QStash hits this every fifteen minutes with the same
// `Authorization: Bearer $CRON_SECRET` header Vercel Cron sends to
// /api/cron/score, so there is one shape for "a scheduler called us" rather
// than two.
//
// Vercel Cron cannot do this job: on Hobby it is once a day, UTC only, with
// timing guaranteed to the hour. Reminders are per member, in their own zone,
// and a last call at ten minutes needs minute precision.

/** How wide a net each run casts. Must match the QStash schedule. */
const SLOT_MINUTES = 15;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // The gate, before any query.
  //
  // 200 and not 401 or 500, deliberately: QStash retries a failure three times,
  // so "off on purpose" has to read as success or every disabled tick becomes
  // four disabled ticks. `skipped` is there so a person reading the QStash log
  // can tell the difference between off and nothing due.
  if (env.PUSH_REMINDERS !== "1") {
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ ok: true, skipped: "unconfigured" });
  }

  const instant = await now();

  // Subscribers, not users. Somebody who has never turned notifications on
  // costs this job one row in a DISTINCT and nothing else, which is also the
  // answer to how it scales: it grows with the people who asked for it.
  const subscribers = await db
    .selectDistinct({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .leftJoin(userApprovals, eq(userApprovals.userId, pushSubscriptions.userId))
    .where(isNull(userApprovals.disabledAt));

  let considered = 0;
  let sent = 0;
  let gone = 0;
  const failures: string[] = [];

  for (const { userId } of subscribers) {
    considered++;
    try {
      const next = await nextFor(userId, instant, SLOT_MINUTES);
      if (!next) continue;

      // RECORD FIRST, THEN SEND, and the order is the whole guard.
      //
      // events_one_push_idx is unique on (user_id, payload->>'slot') for
      // push.sent, so recordEvent returns null when this slot has already gone
      // out and we stop. A crash between the two loses a reminder, which
      // nobody notices. The other order sends twice, which is how somebody
      // turns notifications off and never turns them back on. Same argument as
      // fine_postings, with the cheaper failure on the other side.
      // TITLE AND BODY ARE ON THE EVENT, and that is not redundancy.
      //
      // The first version recorded that a notification had been sent and not
      // what it said. When somebody reported that the notifications were
      // unreadable, there was no way to read them: diagnosing it meant pulling
      // the payloads, rebuilding the situation by hand and re-running the
      // composer to reconstruct sentences that had already been delivered to a
      // phone. The words are the thing under review, so the words are stored.
      // `bun run check:push` reads them back.
      //
      // The repeat rules read them too: `reminder` suppresses a line whose text
      // matches one already sent today, which is only possible because the text
      // is here.
      const claimed = await recordEvent({
        userId,
        type: "push.sent",
        payload: {
          slot: next.slot,
          kind: next.kind,
          typeKey: next.typeKey,
          title: next.title,
          body: next.body,
          count: next.count,
        },
        ignoreConflict: true,
      });
      if (!claimed) continue;

      const result = await deliver(userId, {
        title: next.title,
        body: next.body,
        navigate: `${env.BETTER_AUTH_URL}/`,
        badge: next.count,
        // Held only until the next tick. A reminder that arrives after the
        // window it was about is worse than one that never arrives: it names a
        // deadline that has passed and asks for a press that would be refused.
        ttlSeconds: SLOT_MINUTES * 60,
      });
      sent += result.sent;
      gone += result.gone;
    } catch (e) {
      // One member's bad state must not stop the tick for everybody else. The
      // id is enough to find them; the message goes in the response so a QStash
      // log entry says what happened.
      failures.push(`${userId}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  await recordEvent({
    type: "ops.push.ran",
    payload: { considered, sent, gone, failures: failures.length },
  });

  return NextResponse.json({ ok: true, considered, sent, gone, failures });
}
