import { NextResponse } from "next/server";

import {
  buildProductFeedResponseHeaders,
  getSearchProductsFeedPage,
  logProductFeedRequest,
  PRODUCTS_FEED_PAGE_SIZE,
  PRODUCTS_FEED_REVALIDATE_SECONDS,
} from "@/lib/products-feed";

export const revalidate = 60;

export async function GET(request: Request) {
  const startedAt = performance.now();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const normalizedQuery = query.trim();
  const page = searchParams.get("page");
  const limit = searchParams.get("limit") ?? String(PRODUCTS_FEED_PAGE_SIZE);

  if (normalizedQuery.length < 2) {
    return NextResponse.json({ error: "La recherche doit contenir au moins 2 caracteres." }, { status: 400 });
  }

  try {
    const payload = await getSearchProductsFeedPage({ q: normalizedQuery, page, limit });
    const durationMs = performance.now() - startedAt;

    logProductFeedRequest("/api/products/search", durationMs, payload.items.length, {
      page: payload.page,
      limit: payload.pageSize,
      query: normalizedQuery,
    });

    return NextResponse.json(payload, {
      headers: buildProductFeedResponseHeaders(durationMs, payload.items.length),
    });
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    console.error("[api/products/search] failed", {
      durationMs: Number(durationMs.toFixed(1)),
      message: error instanceof Error ? error.message : "Unknown error",
      query: normalizedQuery,
    });

    return NextResponse.json({ error: "Impossible de lancer la recherche pour le moment." }, { status: 500 });
  }
}