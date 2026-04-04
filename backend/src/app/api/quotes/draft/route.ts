import { NextResponse } from "next/server";

import { getManyChatAccountProfile } from "@/lib/account-manychat";
import { markAbandonedQuoteRecordCleared, upsertAbandonedQuoteRecord } from "@/lib/abandoned-quote-store";
import { getCurrentUser } from "@/lib/user-auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action === "clear" ? "clear" : "sync";

  if (action === "clear") {
    const record = await markAbandonedQuoteRecordCleared(user.id, "cleared");
    return NextResponse.json({ ok: true, record });
  }

  const manychatProfile = await getManyChatAccountProfile(user);
  const record = await upsertAbandonedQuoteRecord({
    userId: user.id,
    userEmail: user.email,
    userDisplayName: user.displayName,
    connectedWhatsapp: manychatProfile.connectedWhatsapp,
    manychatSubscriberId: manychatProfile.manychatSubscriberId,
    manychatFlowId: manychatProfile.manychatFlowId,
    productName: typeof body?.productName === "string" ? body.productName : "",
    quantity: typeof body?.quantity === "string" ? body.quantity : "",
    specifications: typeof body?.specifications === "string" ? body.specifications : "",
    budget: typeof body?.budget === "string" ? body.budget : "",
    shippingWindow: typeof body?.shippingWindow === "string" ? body.shippingWindow : "",
    notes: typeof body?.notes === "string" ? body.notes : undefined,
  });

  return NextResponse.json({ ok: true, record });
}
