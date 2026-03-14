import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabled so Leaflet MapContainer is not double-mounted (avoids "Map container is already initialized").
  reactStrictMode: false,
  // Truth Engine / Epistemic Prism: allow massive PDFs/books (default Next.js is 1 MB).
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  webpack: (config, { isServer }) => {
    // Stub optional/transitive deps that are not used in the Next.js web build.
    config.resolve ??= {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;
