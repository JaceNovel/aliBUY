import { NextResponse } from "next/server";

import { API_URL, buildApiUrl, type ApiOrder } from "@/lib/api";
import type { SourcingOrder } from "@/lib/alibaba-sourcing";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { createCheckoutOrder } from "@/lib/sourcing-service";
import { getCurrentUser } from "@/lib/user-auth";

async function requireUser() {
  return getCurrentUser().catch(() => null);
}

function mapSourcingOrderToApiOrder(order: SourcingOrder): ApiOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    customerEmail: order.customerEmail,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    shippingMethod: order.shippingMethod,
    totalPriceFcfa: order.totalPriceFcfa,
    paymentStatus: order.paymentStatus,
    paymentCurrency: order.paymentCurrency,
    monerooPaymentId: order.monerooPaymentId,
    monerooCheckoutUrl: order.monerooCheckoutUrl,
    monerooPaymentStatus: order.monerooPaymentStatus,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.slug,
      title: item.title,
      productName: item.title,
      image: item.image,
      quantity: item.quantity,
    })),
  };
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const backendAccessToken = await getBackendAccessTokenFromCookies();
  if (user.authProvider === "clerk" || !API_URL || !backendAccessToken) {
    const order = await createCheckoutOrder({
      ...(payload && typeof payload === "object" ? payload : {}),
      userId: user.id,
      payerDisplayName: user.displayName,
      payerEmail: user.email,
    });

    return NextResponse.json({ order: mapSourcingOrderToApiOrder(order) }, { status: 201 });
  }

  const response = await fetch(buildApiUrl("/api/orders"), {
    method: "POST",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
      "content-type": "application/json",
    }),
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { message: "Impossible de creer la commande." }, { status: response.status || 502 });
}
