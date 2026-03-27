"use client";

import type { ImageLoaderProps } from "next/image";

const CLOUDFLARE_IMAGE_RESIZING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_CLOUDFLARE_IMAGE_RESIZING === "1";

function isBypassSource(src: string) {
  return src.startsWith("data:") || src.startsWith("blob:");
}

export default function cloudflareImageLoader({ src, width, quality }: ImageLoaderProps) {
  if (!src || isBypassSource(src) || !CLOUDFLARE_IMAGE_RESIZING_ENABLED) {
    return src;
  }

  if (src.startsWith("/cdn-cgi/image/")) {
    return src;
  }

  const params = [
    `width=${width}`,
    `quality=${quality || 75}`,
    "format=auto",
  ];

  return `/cdn-cgi/image/${params.join(",")}/${encodeURI(src)}`;
}
