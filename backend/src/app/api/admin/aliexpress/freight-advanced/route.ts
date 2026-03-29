import {
  calculateAlibabaAdvancedFreight,
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
  normalizeAlibabaFreightOptions,
} from "@/lib/alibaba-open-platform-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const logisticsProductList: unknown[] = Array.isArray(body?.logisticsProductList)
      ? body.logisticsProductList
      : Array.isArray(body?.logistics_product_list)
        ? body.logistics_product_list
        : [];
    const result = await calculateAlibabaAdvancedFreight({
      eCompanyId: body?.eCompanyId ?? body?.e_company_id,
      destinationCountry: body?.destinationCountry ?? body?.destination_country,
      logisticsProductList: logisticsProductList.map((item) => {
        const entry = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const quantity = typeof entry.quantity === "number" ? entry.quantity : String(entry.quantity ?? "");
        const productIdSource = entry.productId ?? entry.product_id;
        const skuIdSource = entry.skuId ?? entry.sku_id;

        return {
          quantity,
          productId: typeof productIdSource === "number" ? productIdSource : String(productIdSource ?? ""),
          ...(typeof skuIdSource !== "undefined" && skuIdSource !== null
            ? { skuId: typeof skuIdSource === "number" ? skuIdSource : String(skuIdSource) }
            : {}),
        };
      }),
      address: body?.address && typeof body.address === "object" ? body.address as Record<string, unknown> : undefined,
      dispatchLocation: body?.dispatchLocation ?? body?.dispatch_location,
      provinceCode: body?.provinceCode ?? body?.province_code,
      cityCode: body?.cityCode ?? body?.city_code,
      language: body?.language,
      currency: body?.currency,
      locale: body?.locale,
      enableDistributionWaybill: typeof body?.enableDistributionWaybill === "boolean"
        ? body.enableDistributionWaybill
        : typeof body?.enable_distribution_waybill === "boolean"
          ? body.enable_distribution_waybill
          : undefined,
    });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Calcul avance du fret AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({
      options: normalizeAlibabaFreightOptions(result.responseBody),
      responseBody: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Calcul avance du fret AliExpress impossible.",
    }, { status: 400 });
  }
}