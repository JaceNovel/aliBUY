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
    messages: conversation.messages.map((message) => ({ side: message.side, text: message.text })),
  }))} />;
}