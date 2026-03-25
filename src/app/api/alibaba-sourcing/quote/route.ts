import { formatFcfa } from "@/lib/alibaba-sourcing";
import { createAlibabaSourcingQuote } from "@/lib/alibaba-sourcing-server";
import { getSourcingSettings } from "@/lib/sourcing-store";

export async function POST(request: Request) {
  const body = await request.json();
  const settings = await getSourcingSettings();
  const quote = await createAlibabaSourcingQuote(
    Array.isArray(body?.items) ? body.items : [],
    settings,
    { disableFreeAir: body?.disableFreeAir === true },
  );

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