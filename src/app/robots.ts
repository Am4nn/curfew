import type { MetadataRoute } from "next";

// What a crawler is allowed to ask for.
//
// Curfew is invite-only, so exactly one page is reachable without a session:
// the sign-in page. Every other route answers 307 to a signed-out request, so
// a crawler that walked them would collect nothing but redirects back to the
// page it already has, and spend the site's crawl budget doing it.
//
// This is not a security control. The gate in `src/middleware.ts` is, and it
// does not consult this file. A disallow is a request, honoured by the
// crawlers that choose to and ignored by the ones that do not, which is why
// nothing here is the reason anything is private.
//
// `/api/` is listed because a crawler has no business there, not because
// anything in it would answer: the cron route wants a secret and the rest want
// a session.
const ORIGIN = process.env.BETTER_AUTH_URL ?? "https://curfew.amanarya.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/signin"],
        disallow: [
          "/api/",
          "/activities",
          "/activities/",
          "/group/",
          "/groups",
          "/stats",
          "/settings",
          "/settings/",
          "/checkin/",
          "/admin",
          "/admin/",
          "/join/",
          "/pending",
          "/ranks",
        ],
      },
    ],
    sitemap: `${ORIGIN}/sitemap.xml`,
    host: ORIGIN,
  };
}
