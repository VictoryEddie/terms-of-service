import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      }
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: "tos-analyser",
  project: "tos-analyser",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Replaces deprecated hideSourceMaps
  sourcemaps: {
    disable: true,
  },
  // Replaces deprecated disableLogger + automaticVercelMonitors
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: true,
  },
});
