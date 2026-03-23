import { createAlibabaSourcingQuote, formatFcfa } from "@/lib/alibaba-sourcing";
import { getSourcingSettings } from "@/lib/sourcing-store";

export async function POST(request: Request) {
  const body = await request.json();
  const settings = await getSourcingSettings();
  const quote = createAlibabaSourcingQuote(Array.isArray(body?.items) ? body.items : [], settings);

  return Response.json({
    ...quote,
    settings,
    formatted: {
      cartProductsTotal: formatFcfa(quote.cartProductsTotalFcfa),
      shippingOptions: quote.shippingOptions.map((option) => ({
        ...option,
        formattedPrice: formatFcfa(option.priceFcfa),
      })),
    },
  });
}