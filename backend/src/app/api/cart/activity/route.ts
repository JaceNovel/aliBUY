import { NextResponse } from "next/server";

import { getManyChatAccountProfile } from "@/lib/account-manychat";
import { markAbandonedCartRecordCleared, upsertAbandonedCartRecord } from "@/lib/abandoned-cart-store";
import { triggerManyChatAbandonedCartReminder } from "@/lib/manychat";
import { getCurrentUser } from "@/lib/user-auth";

type CartActivityRequest = {
  items?: unknown;
  action?: unknown;
  triggerReminderNow?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null) as CartActivityRequest | null;
    const action = typeof body?.action === "string" ? body.action : "sync";
    const triggerReminderNow = body?.triggerReminderNow === true;

    if (action === "clear") {
      const record = await markAbandonedCartRecordCleared(user.id, "cleared");
      return NextResponse.json({ ok: true, record });
    }

    const items = Array.isArray(body?.items) ? body.items : [];
    const manychatProfile = await getManyChatAccountProfile(user);
    const record = await upsertAbandonedCartRecord({
      userId: user.id,
      userEmail: user.email,
      userDisplayName: user.displayName,
      connectedWhatsapp: manychatProfile.connectedWhatsapp,
      manychatSubscriberId: manychatProfile.manychatSubscriberId,
      manychatFlowId: manychatProfile.manychatFlowId,
      manychatPaidTagId: manychatProfile.manychatPaidTagId,
      items,
    });

    let reminder = null;
    if (triggerReminderNow) {
      reminder = await triggerManyChatAbandonedCartReminder(record).catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      record,
      reminder,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Impossible de synchroniser l'activite panier." },
      { status: 400 },
    );
  }
}
