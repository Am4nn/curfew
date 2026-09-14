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
// every static asset are excluded.
//
// THE RULE IS "ANYTHING WITH A FILE EXTENSION", and it is that rather than a
// list of folders because the list was wrong twice. First the sign-in page's
// three photographs were gated, so a signed-out visitor got the page and every
// image on it answered 307 with HTML. `landing` was added, and then the app
// icons, the launch images, the self-hosted font, `manifest.webmanifest` and
// `robots.txt` arrived and were gated in exactly the same way: no font on the
// one page a stranger sees, no manifest so no install and no splash, and a
// `robots.txt` that redirects, which tells a crawler nothing at all.
//
// A list of folders has to be extended by whoever adds the next folder, and
// nobody remembers, because the app works perfectly while signed in: the
// session cookie carries every asset request straight through. It only breaks
// for people who are not signed in, which is every new member and every
// crawler. `\.` cannot be forgotten. No app route contains a dot; every static
// file does.
//
// The three metadata routes Next generates have no extension, so they are
// named: `apple-icon`, `opengraph-image`, `manifest`.
//
// None of this is a security boundary for anything private. A member's
// photograph is served through an authenticated route and has never been in
// `public/`, which holds the generated marketing images, the icons, the launch
// images and the font.
export const config = {
  matcher: [
    "/((?!api|signin|pending|_next|favicon\\.ico|apple-icon|opengraph-image|manifest|.*\\.).*)",
  ],
};
