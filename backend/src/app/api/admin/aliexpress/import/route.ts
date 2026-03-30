import { API_URL, buildApiUrl } from "@/lib/api";
import { deleteAllImportedProducts, runAlibabaCatalogImport } from "@/lib/alibaba-operations-service";
import { getFreeDealConfig, saveFreeDealConfig } from "@/lib/free-deal-store";

function normalizeCampaignMode(value: unknown) {
  switch (value) {
    case "trends-promo":
    case "trends-hot":
    case "mode-fashion":
    case "free-deal":
      return value;
    default:
      return "standard";
  }
}

function selectFreeDealProductSlugs(products: Array<{ slug: string; minUsd: number; updatedAt: string }>, desiredCount: number) {
  return [...products]
    .sort((left, right) => left.minUsd - right.minUsd || right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, desiredCount)
    .map((product) => product.slug);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const campaignMode = normalizeCampaignMode(body?.campaignMode);

    try {
      if (!API_URL) {
        throw new Error("Local admin AliExpress execution.");
      }

      const upstreamUrl = buildApiUrl("/api/admin/aliexpress/import");
      const currentUrl = new URL(request.url);
      const upstreamHost = new URL(upstreamUrl).host;

      if (upstreamHost && upstreamHost !== currentUrl.host) {
        const upstreamResponse = await fetch(upstreamUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });

        const payload = await upstreamResponse.json().catch(() => null);
        return Response.json(payload, { status: upstreamResponse.status });
      }
    } catch {
      // Fall back to the local store when the upstream backend is unreachable.
    }

    const result = await runAlibabaCatalogImport({
      query: String(body?.query ?? ""),
      limit: Number(body?.limit ?? 12),
      fulfillmentChannel: body?.fulfillmentChannel ?? "crossborder",
      autoPublish: campaignMode === "free-deal" ? true : Boolean(body?.autoPublish),
      campaignMode,
      resetImportedProducts: Boolean(body?.resetImportedProducts),
    });

    let freeDealProductSlugs: string[] | undefined;
    if (campaignMode === "free-deal" && result.products.length > 0) {
      const config = await getFreeDealConfig();
      freeDealProductSlugs = selectFreeDealProductSlugs(result.products, Math.max(config.itemLimit * 3, config.itemLimit));
      await saveFreeDealConfig({ productSlugs: freeDealProductSlugs });
    }

    return Response.json({
      ...result,
      campaignMode,
      freeDealProductSlugs,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Import AliExpress impossible.",
    }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    try {
      if (!API_URL) {
        throw new Error("Local admin AliExpress execution.");
      }

      const upstreamUrl = buildApiUrl("/api/admin/aliexpress/import");
      const currentUrl = new URL(request.url);
      const upstreamHost = new URL(upstreamUrl).host;

      if (upstreamHost && upstreamHost !== currentUrl.host) {
        const upstreamResponse = await fetch(upstreamUrl, {
          method: "DELETE",
          headers: request.headers.get("cookie")
            ? { cookie: request.headers.get("cookie") ?? "" }
            : undefined,
          cache: "no-store",
        });

        const payload = await upstreamResponse.json().catch(() => null);
        return Response.json(payload, { status: upstreamResponse.status });
      }
    } catch {
      // Fall back to the local store when the upstream backend is unreachable.
    }

    const result = await deleteAllImportedProducts();
    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Purge des articles importes impossible.",
    }, { status: 400 });
  }
}
