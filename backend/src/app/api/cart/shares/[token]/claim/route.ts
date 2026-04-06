import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";

function buildProxyHeaders(request: Request) {
  const headers = new Headers();

  for (const headerName of ["cookie", "authorization", "user-agent", "x-forwarded-for", "x-real-ip", "x-forwarded-proto", "x-forwarded-host"]) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!API_URL) {
    return NextResponse.json({ message: "Import du panier partagé indisponible." }, { status: 503 });
  }

  try {
    const { token } = await context.params;
    const upstreamUrl = buildApiUrl(`/api/cart/shares/${encodeURIComponent(token)}/claim`);
    const currentUrl = new URL(request.url);
    const upstreamHost = new URL(upstreamUrl).host;

    if (!upstreamHost || upstreamHost === currentUrl.host) {
      return NextResponse.json({ message: "Import du panier partagé indisponible." }, { status: 503 });
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: buildProxyHeaders(request),
      cache: "no-store",
    });

    const rawPayload = await upstreamResponse.text();
    if (!rawPayload.trim()) {
      return NextResponse.json({ ok: upstreamResponse.ok }, { status: upstreamResponse.status });
    }

    try {
      const payload = JSON.parse(rawPayload) as unknown;
      return NextResponse.json(payload, { status: upstreamResponse.status });
    } catch {
      return NextResponse.json({ message: rawPayload }, { status: upstreamResponse.status });
    }
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Import du panier partagé indisponible.",
    }, { status: 400 });
  }
}
