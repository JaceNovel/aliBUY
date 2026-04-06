import { API_URL, buildApiUrl } from "@/lib/api";
import { getAlibabaImportedProducts } from "@/lib/alibaba-operations-store";
import { runAlibabaCatalogImport } from "@/lib/alibaba-operations-service";
import { getFreeDealConfig, saveFreeDealConfig } from "@/lib/free-deal-store";

type ImportedOption = {
  slug: string;
  minUsd: number;
  query: string;
  shortTitle: string;
  publishedToSite: boolean;
  updatedAt: string;
};

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function toFiniteNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function matchesQuery(product: ImportedOption, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  const haystack = `${product.query} ${product.shortTitle}`.toLowerCase();
  return haystack.includes(normalizedQuery);
}

function selectCampaignProducts(products: ImportedOption[], options: { query: string; maxUsd: number; desiredCount: number }) {
  const normalizedQuery = normalizeQuery(options.query);
  const sorted = [...products]
    .filter((product) => product.publishedToSite)
    .sort((left, right) => {
      const leftQueryScore = matchesQuery(left, normalizedQuery) ? 0 : 1;
      const rightQueryScore = matchesQuery(right, normalizedQuery) ? 0 : 1;
      if (leftQueryScore !== rightQueryScore) {
        return leftQueryScore - rightQueryScore;
      }

      const leftPriceScore = left.minUsd <= options.maxUsd ? 0 : 1;
      const rightPriceScore = right.minUsd <= options.maxUsd ? 0 : 1;
      if (leftPriceScore !== rightPriceScore) {
        return leftPriceScore - rightPriceScore;
      }

      if (left.minUsd !== right.minUsd) {
        return left.minUsd - right.minUsd;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });

  return [...new Set(sorted.slice(0, options.desiredCount).map((product) => product.slug))];
}

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

async function maybeProxy(request: Request, rawBody: string) {
  if (!API_URL) {
    return null;
  }

  try {
    const upstreamUrl = buildApiUrl("/api/admin/free-deals/import");
    const currentUrl = new URL(request.url);
    const upstreamHost = new URL(upstreamUrl).host;

    if (upstreamHost && upstreamHost !== currentUrl.host) {
      const upstreamResponse = await fetch(upstreamUrl, {
        method: "POST",
        headers: buildProxyHeaders(request),
        body: rawBody || "{}",
        cache: "no-store",
      });

      if (upstreamResponse.status === 403 || upstreamResponse.status === 404 || upstreamResponse.status >= 500) {
        console.warn("[admin/free-deals/import] upstream unavailable, fallback to local handler", {
          upstreamUrl,
          status: upstreamResponse.status,
        });
        return null;
      }

      const rawPayload = await upstreamResponse.text();
      if (!rawPayload.trim()) {
        return Response.json({ ok: upstreamResponse.ok }, { status: upstreamResponse.status });
      }

      try {
        const payload = JSON.parse(rawPayload) as unknown;
        return Response.json(payload, { status: upstreamResponse.status });
      } catch {
        return Response.json({ message: rawPayload }, { status: upstreamResponse.status });
      }
    }
  } catch (error) {
    console.warn("[admin/free-deals/import] upstream request failed, fallback to local handler", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }

  return null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const proxied = await maybeProxy(request, rawBody);
  if (proxied) {
    return proxied;
  }

  let body: unknown = {};
  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      return Response.json({ message: "Charge utile invalide." }, { status: 400 });
    }
  }

  try {
    const currentConfig = await getFreeDealConfig();
    const query = String((body as Record<string, unknown>)?.query ?? "").trim();
    if (!query) {
      return Response.json({ message: "Saisis une recherche pour importer des produits gratuits." }, { status: 400 });
    }

    const limit = Math.max(1, Math.min(60, toFiniteNumber((body as Record<string, unknown>)?.limit, Math.max(currentConfig.itemLimit * 3, 18))));
    const maxUsd = Math.max(0.1, toFiniteNumber((body as Record<string, unknown>)?.maxUsd, 5));
    const result = await runAlibabaCatalogImport({
      query,
      limit,
      fulfillmentChannel: "crossborder",
      autoPublish: true,
      campaignMode: "free-deal",
      resetImportedProducts: Boolean((body as Record<string, unknown>)?.resetImportedProducts),
    });
    const importedProducts = await getAlibabaImportedProducts();
    const desiredCount = Math.max(currentConfig.itemLimit * 3, currentConfig.itemLimit, 12);
    const productSlugs = selectCampaignProducts(importedProducts as ImportedOption[], {
      query,
      maxUsd,
      desiredCount,
    });

    if (productSlugs.length === 0) {
      return Response.json({
        message: "Aucun produit publie exploitable n'a ete trouve pour cette campagne.",
      }, { status: 400 });
    }

    const config = await saveFreeDealConfig({ productSlugs });
    return Response.json({
      config,
      importedCount: result.products.length,
      targetImportCount: result.targetImportCount,
      purgedCount: result.purgedCount,
      warningMessage: result.warningMessage,
      productSlugs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import AliExpress impossible pour l'offre gratuite.";
    return Response.json({ message }, { status: 400 });
  }
}
