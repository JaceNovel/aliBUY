import { NextResponse } from "next/server";

import { formatFcfa, getSourcingOrderMeta, withSourcingOrderMeta } from "@/lib/alibaba-sourcing";
import { consumePromoCode, validatePromoCodeForAmount } from "@/lib/promo-codes-store";
import { getSourcingOrderById, saveSourcingOrder } from "@/lib/sourcing-store";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await getSourcingOrderById(id);
  if (!order) {
    return NextResponse.json({ message: "Commande sourcing introuvable." }, { status: 404 });
  }

  if (!(order.userId === user.id || order.customerEmail.toLowerCase() === user.email.toLowerCase())) {
    return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  }

  if (order.paymentStatus !== "unpaid") {
    return NextResponse.json({ message: "Le code promo ne peut plus être modifié après le démarrage du paiement." }, { status: 409 });
  }

  if (order.monerooPaymentId || order.monerooCheckoutUrl) {
    return NextResponse.json({ message: "Le paiement a déjà été initialisé pour cette commande." }, { status: 409 });
  }

  const meta = getSourcingOrderMeta(order);
  if (meta.promo) {
    return NextResponse.json({ message: "Un code promo est déjà appliqué sur cette commande." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json({ message: "Code promo manquant." }, { status: 400 });
  }

  try {
    const promo = await validatePromoCodeForAmount({ code, totalFcfa: order.totalPriceFcfa });
    const timestamp = new Date().toISOString();
    const nextOrder = withSourcingOrderMeta({
      ...order,
      totalPriceFcfa: promo.finalTotalFcfa,
      updatedAt: timestamp,
    }, {
      promo: {
        code: promo.promoCode.code,
        label: promo.promoCode.label,
        discountFcfa: promo.discountFcfa,
        baseTotalFcfa: order.totalPriceFcfa,
        finalTotalFcfa: promo.finalTotalFcfa,
        appliedAt: timestamp,
      },
    });

    await saveSourcingOrder(nextOrder);
    await consumePromoCode({ code: promo.promoCode.code, orderId: order.id });

    return NextResponse.json({
      order: nextOrder,
      promoCode: promo.promoCode.code,
      promoDiscountLabel: formatFcfa(promo.discountFcfa),
      originalTotal: formatFcfa(order.totalPriceFcfa),
      total: formatFcfa(promo.finalTotalFcfa),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d'appliquer ce code promo.";
    return NextResponse.json({ message }, { status: 400 });
  }
}