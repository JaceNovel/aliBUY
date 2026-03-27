"use client";

import { useEffect } from "react";

import { buildApiUrl } from "@/lib/api";

type ProductViewTrackerProps = {
  slug: string;
};

export function ProductViewTracker({ slug }: ProductViewTrackerProps) {
  useEffect(() => {
    const target = buildApiUrl(`/api/products/${encodeURIComponent(slug)}/view`);
    const payload = new Blob([], { type: "application/json" });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(target, payload);
      return;
    }

    void fetch(target, {
      method: "POST",
      keepalive: true,
    }).catch(() => undefined);
  }, [slug]);

  return null;
}
