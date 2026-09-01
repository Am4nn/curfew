import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pg is only used by the local preview driver. Keep it external so webpack
  // does not try to bundle its optional native bits into the production build.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
