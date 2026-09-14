import type { Metadata } from "next";

// The sign-in page is a client component, so its metadata lives here.
//
// It is also the only page on the site a search engine can have: everything
// else answers 307 to a signed-out request. So this is where the description,
// the canonical and the structured data go, and there is nowhere else they
// would do any good.
const ORIGIN = process.env.BETTER_AUTH_URL ?? "https://curfew.amanarya.com";

const DESCRIPTION =
  "A habit tracker that asks for proof. Twelve habits on your own schedule, " +
  "photo evidence where one is worth having, a streak per habit, and private " +
  "groups that see only what you choose to share. Invite only.";

export const metadata: Metadata = {
  // No template here. "Sign in · Curfew" is a worse search result than
  // "Curfew", and this is the page that stands for the whole site.
  title: {
    absolute: "Curfew. Prove it, or it didn't happen.",
  },
  description: DESCRIPTION,
  // One page, one URL. Both `/` and `/signin` serve it to a signed-out
  // visitor, and without this they compete as duplicates.
  alternates: { canonical: `${ORIGIN}/signin` },
  openGraph: {
    type: "website",
    siteName: "Curfew",
    title: "Curfew. Prove it, or it didn't happen.",
    description: DESCRIPTION,
    url: `${ORIGIN}/signin`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Curfew. Prove it, or it didn't happen.",
    description: DESCRIPTION,
  },
};

/**
 * What the page is, in the vocabulary a search engine reads.
 *
 * Deliberately thin. There is no `aggregateRating` and no `review`, because
 * there are three users and an invented number would be the one dishonest
 * thing on a page whose whole pitch is honesty. Fabricated review markup is
 * also the fastest way to earn a manual penalty, so the incentives agree with
 * the principle for once.
 *
 * `isAccessibleForFree` is true and there is no `offers` block: Curfew has no
 * paid tier, and money inside it is IOU tracking between members, never a
 * payment to anybody.
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Curfew",
  url: `${ORIGIN}/signin`,
  description: DESCRIPTION,
  applicationCategory: "HealthApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript.",
  isAccessibleForFree: true,
  inLanguage: "en",
  featureList: [
    "Twelve habit types with per-user schedules",
    "Photo evidence, kept 60 days then deleted",
    "A streak and a best streak for every habit",
    "Private, invite-only groups",
    "A reputation score per group",
  ],
};

export default function SigninLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Rendered as a script tag rather than through the metadata API, which
          has no field for structured data. The content is a constant, so there
          is nothing here that could carry anything a visitor typed. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {children}
    </>
  );
}
