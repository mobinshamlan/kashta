import type { NextConfig } from "next";

// Cache Components is off: the app uses the request-time model (route handlers
// with fetch revalidation), which keeps forecast caching easy to reason about.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
