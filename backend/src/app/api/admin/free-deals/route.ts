import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getCurrentAdminAccess } from "@/lib/admin-auth";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

async function proxyAdminFreeDeals(request: Request) {
  if (!API_URL) {
    return NextResponse.json({ message: "Backend Laravel non configure pour les articles gratuits." }, { status: 503 });
  }

  const adminAccess = await getCurrentAdminAccess().catch(() => null);
  if (!adminAccess) {
    return NextResponse.json({ message: "Connexion admin requise." }, { status: 401 });
  }

  const method = request.method.toUpperCase();
  const contentType = request.headers.get("content-type")?.trim();
  const response = await fetch(`${API_URL}/api/admin/free-deals`, {
    method,
    headers: await buildServerForwardHeaders({
      accept: request.headers.get("accept")?.trim() || "application/json",
      ...(contentType ? { "content-type": contentType } : {}),
    }, {
      includeAdminApiToken: true,
    }),
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

export async function GET(request: Request) {
  return proxyAdminFreeDeals(request);
}

export async function POST(request: Request) {
  return proxyAdminFreeDeals(request);
}

export async function PUT(request: Request) {
  return proxyAdminFreeDeals(request);
}
