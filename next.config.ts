import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb"
    }
  },
  reactStrictMode: true,
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
