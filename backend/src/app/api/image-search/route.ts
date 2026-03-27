import { NextResponse } from "next/server";

import { searchProductsByImage } from "@/lib/image-search";

export async function POST(request: Request) {
  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof File)) {
    return NextResponse.json({ message: "Image manquante." }, { status: 400 });
  }

  const mimeType = image.type.toLowerCase();

  if (!mimeType.startsWith("image/")) {
    return NextResponse.json({ message: "Format non supporte." }, { status: 415 });
  }

  const buffer = Buffer.from(await image.arrayBuffer());

  if (buffer.length === 0) {
    return NextResponse.json({ message: "Image vide." }, { status: 400 });
  }

  const results = await searchProductsByImage(buffer, 6, image.name);

  return NextResponse.json({
    fileName: image.name,
    results: results.map((entry) => ({
      slug: entry.product.slug,
      score: Number(entry.score.toFixed(4)),
    })),
  });
}