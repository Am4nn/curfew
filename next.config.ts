import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The React Compiler memoises components for us, which is only sound if every
  // component obeys the rules of React. That is why `eslint-plugin-react-hooks`
  // is on at its full ruleset rather than just rules-of-hooks: a component the
  // compiler cannot prove safe is silently skipped, so the lint errors are the
  // only place that shows up. It adds a Babel pass, so builds are slower.
  experimental: { reactCompiler: true },
  // pg is only used by the local preview driver. Keep it external so webpack
  // does not try to bundle its optional native bits into the production build.
  serverExternalPackages: ["pg"],

  // Response headers, on every route.
  //
  // Deliberately the boring ones. There is no full Content-Security-Policy
  // here: Next's App Router emits inline bootstrap scripts, so a real policy
  // needs a per-request nonce through middleware, and a wrong one fails as a
  // blank page rather than as an error. `frame-ancestors` is the one directive
  // that costs nothing to get right, and it is the one that matters most,
  // because the whole app is one-click actions behind a session cookie.
  //
  // Two that are absent on purpose. `Cross-Origin-Opener-Policy` can break an
  // OAuth flow that uses a popup, and this one is a redirect today but need not
  // stay one. `preload` on HSTS is a submission to a browser list that is
  // difficult to leave, and it is not ours to make for a domain serving other
  // things.
  // Next types this as returning a promise, and there is nothing to await.
  headers: () =>
    Promise.resolve([
      {
        source: "/:path*",
        headers: [
          // Nothing may frame us: no iframes anywhere in the app, so this is
          // free, and both spellings because the old one is what some scanners
          // and some older browsers read.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          // An uploaded photo is served through our own routes. A response
          // sniffed as HTML is how an image becomes a script.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // A group invite link is a secret in a URL. Do not send the path to
          // another origin.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The camera is the app's own, on the check-in screen. Everything
          // else is off, including for anything the app ever embeds.
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // Honoured over HTTPS only, so localhost is unaffected.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ]),
};

export default nextConfig;
