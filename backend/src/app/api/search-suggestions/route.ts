import { NextResponse } from "next/server";

import { getCatalogSearchSuggestions } from "@/lib/catalog-search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const suggestions = await getCatalogSearchSuggestions(query);

  return NextResponse.json({ suggestions });
}
