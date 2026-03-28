import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, ".."),
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
