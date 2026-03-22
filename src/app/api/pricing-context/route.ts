import type { NextRequest } from "next/server";

import { getPricingContext } from "@/lib/pricing";

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country") ?? undefined;
  const currency = request.nextUrl.searchParams.get("currency") ?? undefined;
  const language = request.nextUrl.searchParams.get("language") ?? undefined;
  const pricing = await getPricingContext(country, currency, language);

  return Response.json({
    countryCode: pricing.countryCode,
    countryLabel: pricing.countryLabel,
    languageCode: pricing.languageCode,
    languageLabel: pricing.languageLabel,
    currency: pricing.currency.code,
    shippingWindow: pricing.shippingWindow,
    exchangeLabel: pricing.exchangeLabel,
    samples: {
      mouse: pricing.formatPrice(29.9),
      chair: pricing.formatPrice(219),
      packaging: pricing.formatPrice(485.2),
    },
  });
}