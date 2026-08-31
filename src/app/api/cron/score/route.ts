import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { scoreAll } from "@/server/scoring";

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
  return NextResponse.json({ ok: true, ...result });
}
