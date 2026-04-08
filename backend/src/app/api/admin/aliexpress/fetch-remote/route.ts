import { maybeProxyAliExpressAdminRequest } from "@/app/api/admin/aliexpress/proxy";
import { fetchAlibabaRemoteExactProduct } from "@/lib/alibaba-operations-service";

function summarizeDebug(debug: unknown) {
  if (!debug || typeof debug !== "object") {
    return undefined;
  }

  const record = debug as Record<string, unknown>;
  const attempts = Array.isArray(record.attempts)
    ? record.attempts.map((attempt) => {
        if (!attempt || typeof attempt !== "object") {
          return attempt;
        }

        const entry = attempt as Record<string, unknown>;
        return {
          endpoint: entry.endpoint,
          shipToCountry: entry.shipToCountry,
          ok: entry.ok,
          status: entry.status,
          responseShape: entry.responseShape,
          mappingStatus: entry.mappingStatus,
          providerErrorCode: entry.providerErrorCode,
          providerRequestId: entry.providerRequestId,
        };
      })
    : undefined;

  return {
    externalProductId: record.externalProductId,
    shipToCountry: record.shipToCountry,
    targetCurrency: record.targetCurrency,
    targetLanguage: record.targetLanguage,
    selectedAccount: record.selectedAccount,
    resolvedRemoteMode: record.resolvedRemoteMode,
    fallbackUsed: record.fallbackUsed,
    responseShape: record.responseShape,
    providerErrorCode: record.providerErrorCode,
    providerMessage: record.providerMessage,
    providerRequestId: record.providerRequestId,
    attempts,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const proxiedResponse = await maybeProxyAliExpressAdminRequest({
      request,
      path: "/api/admin/aliexpress/fetch-remote",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const result = await fetchAlibabaRemoteExactProduct({
      query: String(body?.query ?? body?.externalProductId ?? body?.external_product_id ?? ""),
      destinationCountry: body?.destinationCountry ?? body?.destination_country ?? body?.shipToCountry ?? body?.ship_to_country,
      targetCurrency: body?.targetCurrency ?? body?.target_currency,
      targetLanguage: body?.targetLanguage ?? body?.target_language,
      provinceCode: body?.provinceCode ?? body?.province_code,
      cityCode: body?.cityCode ?? body?.city_code,
      supplierAccountId: body?.supplierAccountId ?? body?.supplier_account_id,
    });

    if (!result.ok || !result.product) {
      console.error("[admin/aliexpress/fetch-remote] failed", {
        query: String(body?.query ?? body?.externalProductId ?? body?.external_product_id ?? ""),
        supplierAccountId: body?.supplierAccountId ?? body?.supplier_account_id,
        message: result.errorMessage ?? "Chargement produit AliExpress impossible.",
        debug: summarizeDebug(result.debug),
      });

      return Response.json({
        message: result.errorMessage ?? "Chargement produit AliExpress impossible.",
        debug: result.debug,
      }, { status: 400 });
    }

    return Response.json({
      endpoint: result.endpoint,
      sourceProductId: result.sourceProductId,
      product: result.product,
      debug: result.debug,
    });
  } catch (error) {
    const debug = error && typeof error === "object" && "debug" in error
      ? (error as { debug?: unknown }).debug
      : undefined;
    const message = error instanceof Error ? error.message : "Chargement produit AliExpress impossible.";

    console.error("[admin/aliexpress/fetch-remote] exception", {
      message,
      debug: summarizeDebug(debug),
    });

    return Response.json({
      message,
      ...(typeof debug === "undefined" ? {} : { debug }),
    }, { status: 400 });
  }
}
