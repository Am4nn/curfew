import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { previewEnabled } from "@/lib/preview";

// Optimistic gate only. This checks for the presence of a session cookie to
// keep unauthenticated traffic off protected routes without a DB round trip on
// the edge. It does NOT decide approval: a valid session can still be a pending
// user. The approval status is read server-side in the page (see
// src/lib/session.ts requireApproved), because it needs the database.
export function middleware(request: NextRequest) {
  // Preview mode is sign-in-free (double-gated, inert in production). The pages
  // resolve a fixed preview identity server-side, so the cookie gate must step
  // aside or every route would bounce to /signin.
  if (previewEnabled()) return NextResponse.next();

  const session = getSessionCookie(request);
  if (!session) {
    const url = new URL("/signin", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Protect the dashboard. Auth routes, the sign-in page, the pending page, and
// static assets are excluded.
//
// `landing` is the sign-in page's own three photographs, and leaving it out
// broke them everywhere. A signed-out visitor got the page, and then every
// image on it redirected to /signin, so the browser was handed HTML where it
// asked for a WebP and drew a broken tile. `_next/image` is excluded and was
// still 307ing, because the optimizer fetches the SOURCE over HTTP and that
// fetch is what the gate was bouncing.
//
// This is the whole of `public/`, and it is three generated marketing images.
// No member's evidence is served from here or ever can be: a photograph goes
// through an authenticated route, which is the point of keeping it off the one
// page served to people who are not signed in.
export const config = {
  matcher: ["/((?!api|signin|pending|landing|_next/static|_next/image|favicon.ico).*)"],
};
