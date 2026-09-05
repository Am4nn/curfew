import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getApprovalStatus } from "@/lib/session";
import { previewEnabled, PREVIEW_USER } from "@/lib/preview";
import { requestUpload } from "@/server/evidence";

// A presigned PUT for one photo. POST, not GET: it writes the pending row, and
// it must not be reachable by prefetch (invariant 9).
//
// The photo itself never comes here. The browser uploads straight to R2 with
// the URL this returns, so no image ever passes through a function.
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

  const body: unknown = await request.json().catch(() => null);
  const ticket = await requestUpload(userId, body);
  if (!ticket.ok) {
    return NextResponse.json(ticket, { status: 409 });
  }
  return NextResponse.json(ticket);
}
