import type { MetadataRoute } from "next";

// Every page a crawler can actually have, which is one.
//
// A sitemap listing routes that answer 307 to the crawler is worse than no
// sitemap: it asks for the whole app to be fetched and returns a redirect
// every time, which is how a site teaches a search engine that its URLs are
// not worth revisiting. Curfew is invite-only, so the sign-in page is the
// public site.
const ORIGIN = process.env.BETTER_AUTH_URL ?? "https://curfew.amanarya.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${ORIGIN}/signin`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
