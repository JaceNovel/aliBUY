import { NextResponse } from "next/server";

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const latitude = toNumber(body?.latitude);
    const longitude = toNumber(body?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ message: "Coordonnées invalides." }, { status: 400 });
    }

    const endpoint = new URL("https://nominatim.openstreetmap.org/reverse");
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("lat", String(latitude));
    endpoint.searchParams.set("lon", String(longitude));
    endpoint.searchParams.set("zoom", "18");
    endpoint.searchParams.set("addressdetails", "1");

    const response = await fetch(endpoint, {
      headers: {
        "user-agent": "AfriPay/1.0 support@afripay.local",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json({ message: "Le service de localisation externe est indisponible." }, { status: 502 });
    }

    const payload = await response.json() as {
      display_name?: string;
      address?: Record<string, string | undefined>;
    };
    const address = payload.address ?? {};
    const city = address.city || address.town || address.village || address.municipality || "";
    const state = address.state || address.region || city;
    const countryCode = address.country_code?.toUpperCase() || "";

    return NextResponse.json({
      displayName: payload.display_name,
      addressLine1: [address.road, address.house_number].filter(Boolean).join(" ").trim() || payload.display_name || "",
      addressLine2: [address.neighbourhood, address.suburb, address.county].filter(Boolean).join(", ") || undefined,
      city,
      state,
      postalCode: address.postcode || undefined,
      countryCode,
      countryLabel: address.country || undefined,
    });
  } catch {
    return NextResponse.json({ message: "Impossible de résoudre la position." }, { status: 500 });
  }
}