import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabled so Leaflet MapContainer is not double-mounted (avoids "Map container is already initialized").
  reactStrictMode: false,
};

export default nextConfig;
