import { buildApiUrl } from "@/lib/api";
import { getAlibabaPurchaseOrders } from "@/lib/alibaba-operations-store";
import { createAlibabaPurchaseOrder } from "@/lib/alibaba-operations-service";

export async function GET(request: Request) {
  try {
    const upstreamUrl = buildApiUrl("/api/admin/aliexpress/purchase-orders");
    const currentUrl = new URL(request.url);
    const upstreamHost = new URL(upstreamUrl).host;

    if (upstreamHost && upstreamHost !== currentUrl.host) {
      const upstreamResponse = await fetch(upstreamUrl, {
        cache: "no-store",
        headers: request.headers.get("cookie")
          ? { cookie: request.headers.get("cookie") ?? "" }
          : undefined,
      });

      const payload = await upstreamResponse.json().catch(() => null);
      return Response.json(payload, { status: upstreamResponse.status });
    }
  } catch {
    // Fall back to the local store when the upstream backend is unreachable.
  }

  const orders = await getAlibabaPurchaseOrders();
  return Response.json({ orders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    try {
      const upstreamUrl = buildApiUrl("/api/admin/aliexpress/purchase-orders");
      const currentUrl = new URL(request.url);
      const upstreamHost = new URL(upstreamUrl).host;

      if (upstreamHost && upstreamHost !== currentUrl.host) {
        const upstreamResponse = await fetch(upstreamUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie") ?? "" } : {}),
          },
          body: JSON.stringify(body),
          cache: "no-store",
        });

        const payload = await upstreamResponse.json().catch(() => null);
        return Response.json(payload, { status: upstreamResponse.status });
      }
    } catch {
      // Fall back to the local store when the upstream backend is unreachable.
    }

    const order = await createAlibabaPurchaseOrder({
      importedProductId: String(body?.importedProductId ?? ""),
      sourceProductId: body?.sourceProductId ? String(body.sourceProductId) : undefined,
      quantity: Number(body?.quantity ?? 1),
      shippingAddressId: body?.shippingAddressId ? String(body.shippingAddressId) : undefined,
    });

    return Response.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creation du lot d'achat impossible.";
    return Response.json({ message }, { status: 400 });
  }
}
