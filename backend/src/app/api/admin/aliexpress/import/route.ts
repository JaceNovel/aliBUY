import { maybeProxyAliExpressAdminRequest } from "@/app/api/admin/aliexpress/proxy";
import type { AlibabaFulfillmentChannel, AlibabaImportCampaignMode } from "@/lib/alibaba-operations";
import { deleteAllImportedProducts, runAlibabaCatalogImport } from "@/lib/alibaba-operations-service";
import { getFreeDealConfig, saveFreeDealConfig } from "@/lib/free-deal-store";

const IMPORT_FULFILLMENT_CHANNELS = new Set<AlibabaFulfillmentChannel>([
  "standard_us",
  "crossborder",
  "fast_us",
  "mexico",
  "best_seller_us",
  "best_seller_mexico",
]);

const IMPORT_CAMPAIGN_MODES = new Set<AlibabaImportCampaignMode>([
  "standard",
  "trends-promo",
  "trends-hot",
  "mode-fashion",
  "free-deal",
]);

function normalizeFulfillmentChannel(value: unknown): AlibabaFulfillmentChannel {
  return typeof value === "string" && IMPORT_FULFILLMENT_CHANNELS.has(value as AlibabaFulfillmentChannel)
    ? (value as AlibabaFulfillmentChannel)
    : "crossborder";
}

function normalizeCampaignMode(value: unknown): AlibabaImportCampaignMode {
  return typeof value === "string" && IMPORT_CAMPAIGN_MODES.has(value as AlibabaImportCampaignMode)
    ? (value as AlibabaImportCampaignMode)
    : "standard";
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

    const proxiedResponse = await maybeProxyAliExpressAdminRequest({
      request,
      path: "/api/admin/aliexpress/import",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const result = await runAlibabaCatalogImport({
      query: String(body?.query ?? ""),
      limit: Number(body?.limit ?? 12),
      fulfillmentChannel: normalizeFulfillmentChannel(body?.fulfillmentChannel),
      autoPublish: campaignMode === "free-deal" ? true : Boolean(body?.autoPublish),
      campaignMode,
      resetImportedProducts: Boolean(body?.resetImportedProducts),
      manualProductMode: Boolean(body?.manualProductMode),
      destinationCountry: body?.destinationCountry ?? body?.destination_country,
      targetCurrency: body?.targetCurrency ?? body?.target_currency,
      targetLanguage: body?.targetLanguage ?? body?.target_language,
      provinceCode: body?.provinceCode ?? body?.province_code,
      cityCode: body?.cityCode ?? body?.city_code,
      supplierAccountId: body?.supplierAccountId ?? body?.supplier_account_id,
      prefetchedExactProduct: body?.prefetchedProduct ?? body?.prefetched_product ?? null,
      prefetchedExactDebug: body?.prefetchedDebug ?? body?.prefetched_debug,
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
    const debug = error && typeof error === "object" && "debug" in error
      ? (error as { debug?: unknown }).debug
      : undefined;

    return Response.json({
      message: error instanceof Error ? error.message : "Import AliExpress impossible.",
      ...(typeof debug === "undefined" ? {} : { debug }),
    }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const proxiedResponse = await maybeProxyAliExpressAdminRequest({
      request,
      path: "/api/admin/aliexpress/import",
      method: "DELETE",
    });

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const result = await deleteAllImportedProducts();
    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Purge des articles importes impossible.",
    }, { status: 400 });
  }
}
