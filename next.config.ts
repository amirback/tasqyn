import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@libsql/client"],
  experimental: {
    optimizePackageImports: ["motion"],
  },
};

export default nextConfig;
