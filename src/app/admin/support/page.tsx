import { AdminSupportClient } from "@/components/admin-support-client";
import { getSupportConversations } from "@/lib/customer-data-store";

export default async function AdminSupportPage() {
  const conversations = await getSupportConversations();

  return <AdminSupportClient serviceConversations={conversations.map((conversation) => ({
    id: conversation.id,
    name: conversation.name,
    email: conversation.email,
    preview: conversation.preview,
    time: conversation.time,
    status: conversation.status,
    role: conversation.role,
    aiEnabled: conversation.aiEnabled,
    updatedAt: conversation.updatedAt,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      side: message.side,
      text: message.text,
      createdAt: message.createdAt,
    })),
  }))} />;
}
