import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";

function buildProxyHeaders(request: Request) {
  const headers = new Headers({ "content-type": "application/json" });

  for (const headerName of ["cookie", "authorization", "user-agent", "x-forwarded-for", "x-real-ip", "x-forwarded-proto", "x-forwarded-host"]) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!API_URL) {
    return NextResponse.json({ message: "Partage de panier indisponible." }, { status: 503 });
  }

  try {
    const upstreamUrl = buildApiUrl("/api/cart/shares");
    const currentUrl = new URL(request.url);
    const upstreamHost = new URL(upstreamUrl).host;

    if (!upstreamHost || upstreamHost === currentUrl.host) {
      return NextResponse.json({ message: "Partage de panier indisponible." }, { status: 503 });
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: buildProxyHeaders(request),
      body: rawBody || "{}",
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
      message: error instanceof Error ? error.message : "Partage de panier indisponible.",
    }, { status: 400 });
  }
}
