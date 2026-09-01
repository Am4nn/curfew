import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getApprovalStatus } from "@/lib/session";
import { previewEnabled, PREVIEW_USER } from "@/lib/preview";
import { performCheckin } from "@/server/checkin";
import { listUserGroups } from "@/server/groups";

// A check-in is an explicit POST from a button press. It is never a GET: a GET
// must be safe, and prefetch, tab restore and link previews all fire GETs
// (PRD 6b). The window and the step are decided server-side from the resolved
// config and the server clock; the client sends no step, so it cannot check in
// out of window or for the wrong step.
export async function POST() {
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

  const groups = await listUserGroups(userId);
  if (groups.length === 0) {
    return NextResponse.json({ ok: false, reason: "no_group" }, { status: 409 });
  }

  const result = await performCheckin(userId, sessionId);
  if (!result.ok) {
    // closed window or duplicate: not a server fault, so 409.
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result);
}
