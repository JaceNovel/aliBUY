import { NextResponse } from "next/server";

import { appendSupportConversationMessage, getUserSupportConversations } from "@/lib/customer-data-store";
import { getCurrentUser } from "@/lib/user-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const conversations = await getUserSupportConversations(user.id);
  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
  const text = typeof body?.text === "string" ? body.text : "";

  if (!conversationId || !text.trim()) {
    return NextResponse.json({ message: "Conversation ou message invalide." }, { status: 400 });
  }

  try {
    const conversation = await appendSupportConversationMessage({ userId: user.id, conversationId, text });
    return NextResponse.json({ ok: true, conversation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Envoi impossible.";
    const status = message.includes("n'est pas configure") ? 503 : 404;
    return NextResponse.json({ message }, { status });
  }
}
