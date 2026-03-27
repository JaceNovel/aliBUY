import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { appendAdminSupportConversationMessage, getSupportConversations } from "@/lib/customer-data-store";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acces refuse." }, { status: 403 });
  }

  const conversations = await getSupportConversations();
  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acces refuse." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
  const text = typeof body?.text === "string" ? body.text : "";

  if (!conversationId || !text.trim()) {
    return NextResponse.json({ message: "Conversation ou message invalide." }, { status: 400 });
  }

  try {
    const conversation = await appendAdminSupportConversationMessage({ conversationId, text });
    return NextResponse.json({ ok: true, conversation });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Envoi impossible." }, { status: 404 });
  }
}
