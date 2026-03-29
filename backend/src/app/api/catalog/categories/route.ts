import { NextResponse } from "next/server";

import { getCatalogCategories } from "@/lib/catalog-category-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const items = await getCatalogCategories();
  return NextResponse.json({ items });
}