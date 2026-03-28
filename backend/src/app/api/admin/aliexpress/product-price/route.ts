import {
  editAlibabaIcbuProductPrice,
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
} from "@/lib/alibaba-open-platform-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await editAlibabaIcbuProductPrice({
      productId: body?.productId ?? body?.product_id,
      price: body?.price && typeof body.price === "object" ? body.price as Record<string, unknown> : undefined,
      skuPrice: Array.isArray(body?.skuPrice)
        ? body.skuPrice as Array<Record<string, unknown>>
        : Array.isArray(body?.sku_price)
          ? body.sku_price as Array<Record<string, unknown>>
          : undefined,
    });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Mise a jour du prix AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({ responseBody: result.responseBody });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Mise a jour du prix AliExpress impossible.",
    }, { status: 400 });
  }
}