import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // bcryptjs + prisma must run on Node, never the edge runtime.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
