import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { env } from "@/lib/env";
import { scoreAll } from "@/server/scoring";
import { recordEvent } from "@/server/events";

// The HOURLY pass. QStash calls this on the hour with
// Authorization: Bearer $CRON_SECRET, forwarded by `scripts/schedule-jobs.ts`.
//
// It used to be a Vercel Cron at 07:00 UTC, once a day, and that is the bug
// this route exists in its current shape to fix. A period cannot be judged
// until every window inside it has shut, and windows are local. 07:00 UTC is
// 12:30 in Kolkata, comfortably late, and 09:00 in Berlin, which is before a
// Berlin member's morning has finished. Their sleep shut at 08:00 UTC, thirty
// three minutes after the job had already run and truthfully reported nothing
// to do, so every day of theirs was scored a day late, for ever.
//
// Moving the hour only moves the cliff west. Running every hour removes it: the
// worst lag between a period closing and being scored is one hour, in any
// timezone, and `recomputeUser`'s seven day lookback covers anything longer.
//
// The sweeps and the drift report are NOT here any more. They are daily work
// and they live in /api/cron/nightly, which also runs the full replay this pass
// deliberately skips.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // CLAIM THE HOUR BEFORE DOING ANY OF IT, which is the same shape
  // /api/cron/remind uses for a tick and `fine_postings` uses for a fine.
  //
  // QStash retries a failed delivery three times, so two invocations can
  // overlap, and money is where that is not survivable: a `fine_postings` claim
  // is FINAL, so a run that claims a posting while another is still scoring
  // that period's peers splits the fine among whoever happened to be scored and
  // no later pass can widen it. Invariant 7 says the shares sum to the fine.
  //
  // `events_one_score_run_idx` is unique on the slot for this event type, so a
  // second caller in the same hour gets null back here and stops.
  const slot = DateTime.utc().toFormat("yyyy-MM-dd'T'HH");
  const claimed = await recordEvent({
    type: "ops.score.ran",
    payload: { slot },
    ignoreConflict: true,
  });
  // 200 and not 409, deliberately. QStash retries a failure, so "somebody else
  // has this hour" has to read as success or one overlap becomes four.
  if (!claimed) return NextResponse.json({ ok: true, slot, skipped: "already ran" });

  // The cheap path: every user carries forward from their last stored day. The
  // full replay is the nightly job's, and `verify` diffs the two.
  const result = await scoreAll({ resume: true });

  return NextResponse.json({ ok: true, slot, ...result });
}
