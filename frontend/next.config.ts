import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, ".."),
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
