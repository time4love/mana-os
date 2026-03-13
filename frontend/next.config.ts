import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabled so Leaflet MapContainer is not double-mounted (avoids "Map container is already initialized").
  reactStrictMode: false,
  // Truth Engine / Epistemic Prism: allow massive PDFs/books (default Next.js is 1 MB).
  serverActions: {
    bodySizeLimit: "50mb",
  },
  // Next.js 14 / early 15: body size limit read from experimental.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
