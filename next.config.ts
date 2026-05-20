import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse v2 uses dynamic require() patterns that Turbopack cannot bundle.
  // Treat it as an external server-only package so Node.js loads it at runtime.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
