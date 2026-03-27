import { NextResponse } from "next/server";

import { PRODUCTS_FEED_PAGE_SIZE } from "@/lib/products-feed";

export const revalidate = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const normalizedQuery = query.trim();
  const page = Number(searchParams.get("page") ?? "1");
  const limit = searchParams.get("limit") ?? String(PRODUCTS_FEED_PAGE_SIZE);
  return NextResponse.json({
    items: [],
    page: Number.isFinite(page) && page > 0 ? page : 1,
    nextPage: null,
    hasMore: false,
    pageSize: Number(limit) > 0 ? Number(limit) : PRODUCTS_FEED_PAGE_SIZE,
    source: "disabled",
    query: normalizedQuery,
  });
}
