import { NextResponse } from "next/server";

import {
  buildProductFeedResponseHeaders,
  getProductsFeedPage,
  logProductFeedRequest,
  PRODUCTS_FEED_PAGE_SIZE,
  PRODUCTS_FEED_REVALIDATE_SECONDS,
} from "@/lib/products-feed";

export const revalidate = 60;

export async function GET(request: Request) {
  const startedAt = performance.now();
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page");
  const limit = searchParams.get("limit") ?? String(PRODUCTS_FEED_PAGE_SIZE);

  try {
    const payload = await getProductsFeedPage({ page, limit });
    const durationMs = performance.now() - startedAt;

    logProductFeedRequest("/api/products", durationMs, payload.items.length, {
      page: payload.page,
      limit: payload.pageSize,
    });

    return NextResponse.json(payload, {
      headers: buildProductFeedResponseHeaders(durationMs, payload.items.length),
    });
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    console.error("[api/products] failed", {
      durationMs: Number(durationMs.toFixed(1)),
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json({ error: "Impossible de charger le catalogue pour le moment." }, { status: 500 });
  }
}