import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getCurrentAdminAccess } from "@/lib/admin-auth";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxyPartnerRequests(request: Request, context: RouteContext) {
  if (!API_URL) {
    return NextResponse.json({ message: "Backend Laravel non configure pour les demandes partenaire." }, { status: 503 });
  }

  const adminAccess = await getCurrentAdminAccess().catch(() => null);
  if (!adminAccess) {
    return NextResponse.json({ message: "Connexion admin requise." }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const { path } = await context.params;
  const upstreamPath = `/api/admin/partner-requests/${path.join("/")}${requestUrl.search}`;
  const method = request.method.toUpperCase();
  const contentType = request.headers.get("content-type")?.trim();
  const headers = await buildServerForwardHeaders({
    accept: request.headers.get("accept")?.trim() || "application/json",
    ...(contentType ? { "content-type": contentType } : {}),
  }, {
    includeAdminApiToken: true,
  });

  const response = await fetch(`${API_URL}${upstreamPath}`, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
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

export async function GET(request: Request, context: RouteContext) {
  return proxyPartnerRequests(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyPartnerRequests(request, context);
}