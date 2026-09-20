import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { recordEvent } from "@/server/events";
import { describeFailure } from "@/lib/job-failure";

// Where a scheduled job goes when it has failed every retry.
//
// QStash calls this because `scripts/schedule-jobs.ts` names it in an
// `Upstash-Failure-Callback` header on all three schedules. It fires once, after
// the last retry, and it is the only moment anybody finds out.
//
// Before this route, a tick that failed three times was gone. The failure sat in
// Upstash's dead letter queue, which the free plan keeps for three days, and
// nothing in this repo had ever read it. The Ops page could show the CONSEQUENCE
// a day later, as drift, but not the fault, and a person reading drift cannot
// tell a scoring bug from a job that never ran.
//
// This is a POST and the other three cron routes are GETs, because QStash
// chooses the method for a callback and it posts the report. Everything else is
// the same: the bearer check, and 200 for anything that is not "you are not the
// scheduler", because a callback that answers with a failure is a failure QStash
// will retry, and a retry storm about a retry is not an improvement.
export async function POST(request: NextRequest) {
  // Forwarded by Upstash-Failure-Callback-Forward-Authorization, which is the
  // same secret and the same header name the three job routes already check.
  // One shape for "a scheduler called us", not two.
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // The shaping is in @/lib/job-failure so it can be tested without a database.
  // A malformed report still records: see describeFailure.
  const raw: unknown = await request.json().catch(() => null);
  await recordEvent({
    type: "ops.job.failed",
    payload: describeFailure(raw),
    // events_one_job_failure_idx is unique on dlqId for this type, so a
    // callback delivered twice records once.
    ignoreConflict: true,
  });

  return NextResponse.json({ ok: true });
}
