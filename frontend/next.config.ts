import path from "node:path";

import type { NextConfig } from "next";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").trim().replace(/\/$/, "");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
      {
        source: "/sanctum/:path*",
        destination: `${apiBaseUrl}/sanctum/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.symlinks = false;
    config.resolve.modules = [
      path.join(__dirname, "node_modules"),
      path.join(__dirname, "..", "node_modules"),
      ...(config.resolve.modules ?? []),
    ];

    return config;
  },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/cloudflare-image-loader.ts",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s.alicdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.alicdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.alibaba.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.alibabausercontent.com",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "**.alicdn.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
