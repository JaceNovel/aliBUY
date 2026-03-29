import { NextResponse } from "next/server";

import { getCatalogProducts } from "@/lib/catalog-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const items = await getCatalogProducts();
  return NextResponse.json({ items });
}