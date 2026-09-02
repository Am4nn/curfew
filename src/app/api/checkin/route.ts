import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getApprovalStatus } from "@/lib/session";
import { previewEnabled, PREVIEW_USER } from "@/lib/preview";
import { performCheckin } from "@/server/checkin";

// A check-in is an explicit POST from a button press. It is never a GET: a GET
// must be safe, and prefetch, tab restore and link previews all fire GETs
// (PRD 6b, invariant 9).
//
// The body names the type, the step and the press's own idempotency key. The
// WINDOW is still decided server-side from the resolved config and the server
// clock, so a client cannot check in out of window; the key only decides
// whether this press is the same one as the last.
export async function POST(request: Request) {
  let userId: string;
  let sessionId: string | null;
  if (previewEnabled()) {
    userId = PREVIEW_USER.id;
    sessionId = null;
  } else {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }
    userId = session.user.id;
    sessionId = session.session.id;
  }

  if ((await getApprovalStatus(userId)) !== "approved") {
    // Covers pending, rejected and disabled.
    return NextResponse.json({ ok: false, reason: "not_approved" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const result = await performCheckin(userId, sessionId, body);
  if (!result.ok) {
    // A closed window, a duplicate or a bad entry is not a server fault.
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result);
}
