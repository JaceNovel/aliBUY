import { NextResponse } from "next/server";

import { appendSupportConversationMessage, ensureDefaultSupportConversation } from "@/lib/customer-data-store";
import { getCurrentUser } from "@/lib/user-auth";

type QuickStartTopic = "order" | "refund";

function resolveQuickStartMessage(topic: QuickStartTopic) {
  if (topic === "refund") {
    return "Bonjour AfriPay, j'ai besoin d'une assistance remboursement ou après-vente. Je vous écris depuis le centre d'assistance.";
  }

  return "Bonjour AfriPay, j'ai besoin d'une assistance sur une commande. Je vous écris depuis le centre d'assistance.";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { topic?: unknown } | null;
  const topic = body?.topic === "refund" ? "refund" : body?.topic === "order" ? "order" : null;

  if (!topic) {
    return NextResponse.json({ message: "Sujet d'assistance invalide." }, { status: 400 });
  }

  try {
    const conversation = await ensureDefaultSupportConversation({
      userId: user.id,
      userEmail: user.email,
      userDisplayName: user.displayName,
    });

    const nextConversation = await appendSupportConversationMessage({
      userId: user.id,
      conversationId: conversation.id,
      text: resolveQuickStartMessage(topic),
    });

    return NextResponse.json({ ok: true, conversationId: nextConversation.id });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Impossible d'ouvrir l'assistance." },
      { status: 400 },
    );
  }
}