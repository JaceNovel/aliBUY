import { maybeProxyAliExpressAdminRequest } from "@/app/api/admin/aliexpress/proxy";
import { fetchAlibabaRemoteExactProduct } from "@/lib/alibaba-operations-service";

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

    return Response.json({
      message: error instanceof Error ? error.message : "Chargement produit AliExpress impossible.",
      ...(typeof debug === "undefined" ? {} : { debug }),
    }, { status: 400 });
  }
}
