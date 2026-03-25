import { cookies, headers } from "next/headers";

import { FREE_DEAL_DEVICE_COOKIE } from "@/lib/free-deal-constants";
import { createFreeDealOrder, resolveRequestIp } from "@/lib/free-deal-service";
import { getFreeDealAccessState, getFreeDealConfig } from "@/lib/free-deal-store";
import { getCurrentUser } from "@/lib/user-auth";

export const runtime = "nodejs";

function toStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toSelectedSlugs(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return Response.json({ message: "Requete invalide." }, { status: 400 });
    }

    const [
      config,
      cookieStore,
      headerStore,
      user,
    ] = await Promise.all([
      getFreeDealConfig(),
      cookies(),
      headers(),
      getCurrentUser(),
    ]);

    const deviceId = cookieStore.get(FREE_DEAL_DEVICE_COOKIE)?.value ?? null;
    const ip = resolveRequestIp(headerStore);
    const userAgent = headerStore.get("user-agent");
    const access = await getFreeDealAccessState({
      deviceId,
      ip,
      userAgent,
      userId: user?.id,
      customerEmail: user?.email,
    }, config);

    if (access.status === "disabled") {
      return Response.json({ message: "Cette offre est momentanement indisponible." }, { status: 409 });
    }

    if (access.status === "blocked") {
      return Response.json({
        message: "Cette offre est deja consommee sur cet appareil. Partagez votre lien pour la debloquer.",
      }, { status: 403 });
    }

    const selectedSlugs = toSelectedSlugs((payload as Record<string, unknown>).selectedSlugs);
    const customerName = toStringValue((payload as Record<string, unknown>).customerName);
    const customerEmail = toStringValue((payload as Record<string, unknown>).customerEmail).toLowerCase();
    const customerPhone = toStringValue((payload as Record<string, unknown>).customerPhone);
    const addressLine1 = toStringValue((payload as Record<string, unknown>).addressLine1);
    const addressLine2 = toStringValue((payload as Record<string, unknown>).addressLine2);
    const city = toStringValue((payload as Record<string, unknown>).city);
    const state = toStringValue((payload as Record<string, unknown>).state) || city;
    const postalCode = toStringValue((payload as Record<string, unknown>).postalCode);
    const countryCode = toStringValue((payload as Record<string, unknown>).countryCode) || "FR";

    if (!customerName || !customerEmail || !customerPhone || !addressLine1 || !city || !countryCode) {
      return Response.json({ message: "Merci de renseigner vos informations de livraison." }, { status: 400 });
    }

    if (!customerEmail.includes("@")) {
      return Response.json({ message: "Email invalide." }, { status: 400 });
    }

    const order = await createFreeDealOrder({
      config,
      selectedSlugs,
      customer: {
        customerName,
        customerEmail,
        customerPhone,
        addressLine1,
        addressLine2: addressLine2 || undefined,
        city,
        state,
        postalCode: postalCode || undefined,
        countryCode,
      },
      visitor: {
        deviceId,
        ip,
        userAgent,
        userId: user?.id,
        customerEmail,
      },
      user,
    });

    return Response.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de preparer cette commande gratuite.";
    return Response.json({ message }, { status: 500 });
  }
}
