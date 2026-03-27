import { NextResponse } from "next/server";

import { PRODUCTS_FEED_PAGE_SIZE } from "@/lib/products-feed";

export const revalidate = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit");
  const mode = searchParams.get("mode") ?? "recommended";
  return NextResponse.json({
    items: [],
    page: 1,
    nextPage: null,
    hasMore: false,
    pageSize: Number(limit) > 0 ? Number(limit) : PRODUCTS_FEED_PAGE_SIZE,
    source: "disabled",
    mode,
  });
}
