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
};

export default nextConfig;
