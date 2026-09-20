import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { scoreAll } from "@/server/scoring";
import { sweepEvidence } from "@/server/evidence";
import { archiveEmptyGroups } from "@/server/groups";
import { verifyAll } from "@/server/verify";
import { recordEvent } from "@/server/events";

// The DAILY pass, everything that does not need to happen every hour. QStash
// calls it with the same Bearer $CRON_SECRET header as the other two routes.
//
// It is not "the leftovers". The full replay below is the reason the drift
// report underneath it means anything: the hourly job resumes from each user's
// last stored day, this one recomputes every user from the beginning, and then
// `verifyAll` diffs the stored rows against a third computation. While both
// scheduled passes were the full replay, that check compared a thing to itself.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // No resume: replay everyone from the first day they tracked anything. Every
  // write is an idempotent upsert, so this agrees with the hourly pass or the
  // verify below says which one is wrong.
  const result = await scoreAll();

  // The sweeps run beside scoring, not on their own schedule: one job, one
  // secret, one place a failure shows up. Scoring first, because a photo past
  // its date has already been used for everything it is going to be used for.
  const swept = await sweepEvidence();

  // A group nobody is in any more (item 24). Groups are not deletable, so
  // leaving is what a member does and the last one leaving is how a group
  // reaches nobody. Something has to notice, or it sits there accepting
  // nothing and being counted by every admin list for ever.
  const emptied = await archiveEmptyGroups();

  // Then check the day's work, and REPORT it rather than repair it.
  //
  // Drift is evidence that something computed the wrong number. Silently
  // rewriting the rows destroys the evidence and lets a scoring bug run for
  // months, because the symptom is erased every night. Admin Ops has a Rebuild
  // button for when a person has decided to fix it.
  //
  // A reconciliation nobody runs finds nothing, which is the whole reason this
  // moved from a command someone remembers into the job.
  const drift = await verifyAll({
    from: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10),
  });
  const verified = { rows: drift.length, kinds: countKinds(drift) };
  await recordEvent({ type: "ops.verify.ran", payload: verified });

  return NextResponse.json({
    ok: true,
    ...result,
    evidence: swept,
    emptyGroupsArchived: emptied,
    verify: verified,
  });
}

/** How many of each kind, so the recorded run says what sort of wrong it was. */
function countKinds(drift: { kind: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of drift) out[d.kind] = (out[d.kind] ?? 0) + 1;
  return out;
}
