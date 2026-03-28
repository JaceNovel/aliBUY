import { NextResponse } from "next/server";

import { createQuoteRequest, ensureDefaultSupportConversation } from "@/lib/customer-data-store";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const productName = typeof body?.productName === "string" ? body.productName : "";
  const quantity = typeof body?.quantity === "string" ? body.quantity : "";
  const specifications = typeof body?.specifications === "string" ? body.specifications : "";
  const budget = typeof body?.budget === "string" ? body.budget : "";
  const shippingWindow = typeof body?.shippingWindow === "string" ? body.shippingWindow : "";
  const notes = typeof body?.notes === "string" ? body.notes : undefined;

  if (!productName.trim() || !quantity.trim() || !specifications.trim()) {
    return NextResponse.json({ message: "Produit, quantite et specifications sont obligatoires." }, { status: 400 });
  }

  try {
    const requestRecord = await createQuoteRequest({
      userId: user.id,
      userEmail: user.email,
      userDisplayName: user.displayName,
      productName,
      quantity,
      specifications,
      budget,
      shippingWindow,
      notes,
    });

    await ensureDefaultSupportConversation({
      userId: user.id,
      userEmail: user.email,
      userDisplayName: user.displayName,
    });

    return NextResponse.json({ ok: true, request: requestRecord }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d'enregistrer la demande de devis.";
    const status = message.includes("n'est pas configure") ? 503 : 400;
    return NextResponse.json({ message }, { status });
  }
}