import { NextResponse } from "next/server";

import { extractCoordinatesFromGoogleMapsUrl, isGoogleMapsShortUrl } from "@/lib/google-maps";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const inputUrl = typeof body?.url === "string" ? body.url.trim() : "";

    if (!inputUrl) {
      return NextResponse.json({ message: "Lien Google Maps manquant." }, { status: 400 });
    }

    const directCoordinates = extractCoordinatesFromGoogleMapsUrl(inputUrl);
    if (directCoordinates) {
      return NextResponse.json({ coordinates: directCoordinates, resolvedUrl: inputUrl });
    }

    if (!isGoogleMapsShortUrl(inputUrl)) {
      return NextResponse.json({ message: "Le lien Google Maps doit contenir des coordonnées exploitables." }, { status: 400 });
    }

    const response = await fetch(inputUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": "AfriPay/1.0 support@afripay.local",
      },
      next: { revalidate: 0 },
    });

    const resolvedUrl = response.url || inputUrl;
    const resolvedCoordinates = extractCoordinatesFromGoogleMapsUrl(resolvedUrl);

    if (!resolvedCoordinates) {
      return NextResponse.json({ message: "Le lien Google Maps ne fournit pas de coordonnées lisibles." }, { status: 400 });
    }

    return NextResponse.json({ coordinates: resolvedCoordinates, resolvedUrl });
  } catch {
    return NextResponse.json({ message: "Impossible de lire ce lien Google Maps." }, { status: 500 });
  }
}