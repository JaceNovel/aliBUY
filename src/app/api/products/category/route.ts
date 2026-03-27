import { NextResponse } from "next/server";

import {
  buildProductFeedResponseHeaders,
  getCategoryProductsFeedPage,
  logProductFeedRequest,
  PRODUCTS_FEED_PAGE_SIZE,
  PRODUCTS_FEED_REVALIDATE_SECONDS,
} from "@/lib/products-feed";

export const revalidate = 60;

export async function GET(request: Request) {
  const startedAt = performance.now();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "";
  const normalizedCategory = category.trim();
  const page = searchParams.get("page");
  const limit = searchParams.get("limit") ?? String(PRODUCTS_FEED_PAGE_SIZE);

  if (!normalizedCategory) {
    return NextResponse.json({ error: "La categorie est obligatoire." }, { status: 400 });
  }

  try {
    const payload = await getCategoryProductsFeedPage({ category: normalizedCategory, page, limit });
    const durationMs = performance.now() - startedAt;

    logProductFeedRequest("/api/products/category", durationMs, payload.items.length, {
      page: payload.page,
      limit: payload.pageSize,
      category: normalizedCategory,
    });

    return NextResponse.json(payload, {
      headers: buildProductFeedResponseHeaders(durationMs, payload.items.length),
    });
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    console.error("[api/products/category] failed", {
      durationMs: Number(durationMs.toFixed(1)),
      message: error instanceof Error ? error.message : "Unknown error",
      category: normalizedCategory,
    });

    return NextResponse.json({ error: "Impossible de charger cette categorie pour le moment." }, { status: 500 });
  }
}