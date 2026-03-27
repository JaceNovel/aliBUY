import { NextResponse } from "next/server";

import { incrementProductViewCount } from "@/lib/products-feed";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    await incrementProductViewCount(slug);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[api/products/view] failed", {
      slug,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json({ error: "Impossible d'enregistrer la vue produit." }, { status: 500 });
  }
}