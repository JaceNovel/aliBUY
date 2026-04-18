import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getCurrentAdminAccess } from "@/lib/admin-auth";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function handleLocalAlibabaAdminRoute(request: Request, path: string[]) {
  const normalizedPath = path.map((segment) => segment.trim()).filter(Boolean);

  try {
    if (request.method.toUpperCase() === "POST" && normalizedPath.length === 2 && normalizedPath[0] === "import" && normalizedPath[1] === "reenrich") {
      const { reenrichAllImportedProducts } = await import("@/lib/alibaba-operations-service");
      const result = await reenrichAllImportedProducts();
      return NextResponse.json(result);
    }

    if (request.method.toUpperCase() === "POST" && normalizedPath.length === 3 && normalizedPath[0] === "import" && normalizedPath[2] === "reenrich") {
      const importedProductId = normalizedPath[1];
      const { reenrichImportedProduct } = await import("@/lib/alibaba-operations-service");
      const product = await reenrichImportedProduct(importedProductId);
      return NextResponse.json({
        message: "Article reenrichi avec les donnees source les plus recentes.",
        product,
      });
    }
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Reenrichissement impossible.",
    }, { status: 500 });
  }

  return null;
}

async function proxyAdminAlibaba(request: Request, context: RouteContext) {
  const { path } = await context.params;

  if (!API_URL) {
    const adminAccess = await getCurrentAdminAccess().catch(() => null);
    if (!adminAccess) {
      return NextResponse.json({ message: "Connexion admin requise." }, { status: 401 });
    }

    const localResponse = await handleLocalAlibabaAdminRoute(request, path);
    if (localResponse) {
      return localResponse;
    }

    return NextResponse.json({ message: "Backend Laravel non configure pour le flux fournisseur." }, { status: 503 });
  }

  const adminAccess = await getCurrentAdminAccess().catch(() => null);
  if (!adminAccess) {
    return NextResponse.json({ message: "Connexion admin requise." }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const upstreamPath = `/api/admin/alibaba/${path.join("/")}${requestUrl.search}`;
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
    redirect: "manual",
  });

  const responseHeaders = new Headers();
  const responseContentType = response.headers.get("content-type");
  const responseLocation = response.headers.get("location");
  responseHeaders.set("x-afripay-admin-proxy", "frontend-alibaba");
  if (responseContentType) {
    responseHeaders.set("content-type", responseContentType);
  }
  if (responseLocation) {
    responseHeaders.set("location", responseLocation);
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return proxyAdminAlibaba(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyAdminAlibaba(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return proxyAdminAlibaba(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyAdminAlibaba(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyAdminAlibaba(request, context);
}
