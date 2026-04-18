import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getCurrentAdminAccess } from "@/lib/admin-auth";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

async function handleLocalAdminFreeDeals(request: Request) {
  if (request.method.toUpperCase() === "GET") {
    const { getFreeDealAdminSummary } = await import("@/lib/free-deal-store");
    return NextResponse.json(await getFreeDealAdminSummary());
  }

  if (request.method.toUpperCase() === "PUT") {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ message: "Payload invalide." }, { status: 400 });
    }

    const { saveFreeDealConfig } = await import("@/lib/free-deal-store");
    const config = await saveFreeDealConfig({
      enabled: Boolean(body.enabled),
      pageTitle: typeof body.pageTitle === "string" ? body.pageTitle : undefined,
      heroBadge: typeof body.heroBadge === "string" ? body.heroBadge : undefined,
      heroTitle: typeof body.heroTitle === "string" ? body.heroTitle : undefined,
      heroSubtitle: typeof body.heroSubtitle === "string" ? body.heroSubtitle : undefined,
      bannerText: typeof body.bannerText === "string" ? body.bannerText : undefined,
      ctaLabel: typeof body.ctaLabel === "string" ? body.ctaLabel : undefined,
      shareTitle: typeof body.shareTitle === "string" ? body.shareTitle : undefined,
      shareDescription: typeof body.shareDescription === "string" ? body.shareDescription : undefined,
      itemLimit: typeof body.itemLimit === "number" ? body.itemLimit : undefined,
      fixedPriceEur: typeof body.fixedPriceEur === "number" ? body.fixedPriceEur : undefined,
      referralGoal: typeof body.referralGoal === "number" ? body.referralGoal : undefined,
      dealTagText: typeof body.dealTagText === "string" ? body.dealTagText : undefined,
      productBadgeText: typeof body.productBadgeText === "string" ? body.productBadgeText : undefined,
      compareAtMultiplier: typeof body.compareAtMultiplier === "number" ? body.compareAtMultiplier : undefined,
      compareAtExtraEur: typeof body.compareAtExtraEur === "number" ? body.compareAtExtraEur : undefined,
      productSlugs: Array.isArray(body.productSlugs)
        ? body.productSlugs.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : undefined,
    });

    return NextResponse.json({ config, message: "Configuration des articles gratuits enregistree." });
  }

  return NextResponse.json({ message: "Action articles gratuits indisponible localement." }, { status: 501 });
}

async function proxyAdminFreeDeals(request: Request) {
  const adminAccess = await getCurrentAdminAccess().catch(() => null);
  if (!adminAccess) {
    return NextResponse.json({ message: "Connexion admin requise." }, { status: 401 });
  }

  if (!API_URL) {
    return handleLocalAdminFreeDeals(request);
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
