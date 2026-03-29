import { NextResponse } from "next/server";

import { buildApiUrl } from "@/lib/api";
import {
  PRODUCTS_FEED_PAGE_SIZE,
  buildProductFeedResponseHeaders,
  getFeaturedProductsFeed,
  logProductFeedRequest,
} from "@/lib/products-feed";

export const revalidate = 60;

export async function GET(request: Request) {
  const startedAt = performance.now();
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit");
  const mode = searchParams.get("mode") ?? "recommended";

  try {
    const upstreamUrl = buildApiUrl("/api/products/featured", { limit: limit ?? "", mode });
    const currentUrl = new URL(request.url);
    const upstreamHost = new URL(upstreamUrl).host;

    if (upstreamHost && upstreamHost !== currentUrl.host) {
      const upstreamResponse = await fetch(upstreamUrl, { cache: "no-store" });
      const payload = await upstreamResponse.json().catch(() => null);
      return NextResponse.json(payload, { status: upstreamResponse.status });
    }
  } catch {
    // Fall back to the local store when the upstream backend is unreachable.
  }

  const payload = await getFeaturedProductsFeed({ limit, mode });
  const durationMs = performance.now() - startedAt;

  logProductFeedRequest("/api/products/featured", durationMs, payload.items.length, {
    mode: payload.mode ?? "recommended",
    pageSize: payload.pageSize,
    source: payload.source,
  });

  return NextResponse.json(payload, {
    headers: buildProductFeedResponseHeaders(durationMs, payload.items.length),
  });
}
