import { NextResponse } from "next/server";

import { buildApiUrl } from "@/lib/api";
import {
  PRODUCTS_FEED_PAGE_SIZE,
  buildProductFeedResponseHeaders,
  getCategoryProductsFeedPage,
  logProductFeedRequest,
} from "@/lib/products-feed";

export const revalidate = 60;

export async function GET(request: Request) {
  const startedAt = performance.now();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const limit = searchParams.get("limit") ?? String(PRODUCTS_FEED_PAGE_SIZE);

  try {
    const upstreamUrl = buildApiUrl("/api/products/category", { category, page, limit });
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

  const payload = await getCategoryProductsFeedPage({ category, page, limit });
  const durationMs = performance.now() - startedAt;

  logProductFeedRequest("/api/products/category", durationMs, payload.items.length, {
    category: payload.category ?? "",
    page: payload.page,
    pageSize: payload.pageSize,
    source: payload.source,
  });

  return NextResponse.json(payload, {
    headers: buildProductFeedResponseHeaders(durationMs, payload.items.length),
  });
}
