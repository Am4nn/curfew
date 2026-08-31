import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic gate only. This checks for the presence of a session cookie to
// keep unauthenticated traffic off protected routes without a DB round trip on
// the edge. It does NOT decide approval: a valid session can still be a pending
// user. The approval status is read server-side in the page (see
// src/lib/session.ts requireApproved), because it needs the database.
export function middleware(request: NextRequest) {
  const session = getSessionCookie(request);
  if (!session) {
    const url = new URL("/signin", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Protect the dashboard. Auth routes, the sign-in page, the pending page, and
// static assets are excluded.
export const config = {
  matcher: ["/((?!api|signin|pending|_next/static|_next/image|favicon.ico).*)"],
};
