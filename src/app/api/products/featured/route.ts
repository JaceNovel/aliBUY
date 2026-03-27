import { NextResponse } from "next/server";

import {
  buildProductFeedResponseHeaders,
  getFeaturedProductsFeed,
  logProductFeedRequest,
  PRODUCTS_FEED_REVALIDATE_SECONDS,
} from "@/lib/products-feed";

export const revalidate = 60;

export async function GET(request: Request) {
  const startedAt = performance.now();
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit");
  const mode = searchParams.get("mode") ?? "recommended";

  try {
    const payload = await getFeaturedProductsFeed({ limit, mode });
    const durationMs = performance.now() - startedAt;

    logProductFeedRequest("/api/products/featured", durationMs, payload.items.length, {
      limit: payload.pageSize,
      mode: payload.mode,
    });

    return NextResponse.json(payload, {
      headers: buildProductFeedResponseHeaders(durationMs, payload.items.length),
    });
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    console.error("[api/products/featured] failed", {
      durationMs: Number(durationMs.toFixed(1)),
      message: error instanceof Error ? error.message : "Unknown error",
      mode,
    });

    return NextResponse.json({ error: "Impossible de charger les produits mis en avant." }, { status: 500 });
  }
}