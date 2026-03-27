import {
  calculateAlibabaBasicFreight,
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
  normalizeAlibabaFreightOptions,
} from "@/lib/alibaba-open-platform-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await calculateAlibabaBasicFreight({
      destinationCountry: body?.destinationCountry ?? body?.destination_country,
      productId: body?.productId ?? body?.product_id,
      quantity: body?.quantity,
      zipCode: body?.zipCode ?? body?.zip_code,
      dispatchLocation: body?.dispatchLocation ?? body?.dispatch_location,
      enableDistributionWaybill: typeof body?.enableDistributionWaybill === "boolean"
        ? body.enableDistributionWaybill
        : typeof body?.enable_distribution_waybill === "boolean"
          ? body.enable_distribution_waybill
          : undefined,
    });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Calcul du fret Alibaba impossible.",
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
      message: error instanceof Error ? error.message : "Calcul du fret Alibaba impossible.",
    }, { status: 400 });
  }
}