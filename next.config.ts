import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Don't try to bundle the ml/ JSON model files or db — they're read at runtime from disk
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
