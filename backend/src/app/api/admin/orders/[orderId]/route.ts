import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getCurrentAdminAccess } from "@/lib/admin-auth";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  if (!API_URL) {
    return NextResponse.json({ message: "Backend Laravel non configure pour les commandes admin." }, { status: 503 });
  }

  const adminAccess = await getCurrentAdminAccess().catch(() => null);
  if (!adminAccess) {
    return NextResponse.json({ message: "Connexion admin requise." }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const { orderId } = await context.params;
  const upstreamPath = `/api/admin/orders/${encodeURIComponent(orderId)}${requestUrl.search}`;
  const response = await fetch(`${API_URL}${upstreamPath}`, {
    method: "GET",
    headers: await buildServerForwardHeaders({
      accept: request.headers.get("accept")?.trim() || "application/json",
    }, {
      includeAdminApiToken: true,
    }),
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const responseContentType = response.headers.get("content-type");
  if (responseContentType) {
    responseHeaders.set("content-type", responseContentType);
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
