import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { scoreAll } from "@/server/scoring";
import { sweepEvidence } from "@/server/evidence";
import { verifyAll } from "@/server/verify";
import { recordEvent } from "@/server/events";

// Vercel Cron hits this once a day with Authorization: Bearer $CRON_SECRET.
// Verify it here: without this check, the public URL would let anyone trigger
// scoring. The job is idempotent and scores every unscored date up to the last
// closed period, so a missed or delayed run loses nothing.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const result = await scoreAll();
  // The sweeps run beside scoring, not on their own schedule: one job, one
  // secret, one place a failure shows up. Scoring first, because a photo past
  // its date has already been used for everything it is going to be used for.
  const swept = await sweepEvidence();

  // Then check the night's work, and REPORT it rather than repair it.
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

  return NextResponse.json({ ok: true, ...result, evidence: swept, verify: verified });
}

/** How many of each kind, so the recorded run says what sort of wrong it was. */
function countKinds(drift: { kind: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of drift) out[d.kind] = (out[d.kind] ?? 0) + 1;
  return out;
}
