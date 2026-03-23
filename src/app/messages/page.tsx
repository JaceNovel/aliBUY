import { InternalPageShell } from "@/components/internal-page-shell";
import { MessagesClient } from "@/app/messages/messages-client";
import { ensureDefaultSupportConversation, getUserSupportConversations } from "@/lib/customer-data-store";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";

type MessagesPageProps = {
  searchParams: Promise<{
    tab?: string;
    conversationId?: string;
    orderId?: string;
  }>;
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const pricing = await getPricingContext();
  const resolvedSearchParams = await searchParams;
  const user = await getCurrentUser();

  if (user) {
    await ensureDefaultSupportConversation({ userId: user.id, userEmail: user.email, userDisplayName: user.displayName });
  }

  const conversations = user ? await getUserSupportConversations(user.id) : [];

  return (
    <InternalPageShell pricing={pricing}>
      <MessagesClient
        conversations={conversations.map((conversation) => ({
          id: conversation.id,
          name: conversation.name,
          email: conversation.email,
          role: conversation.role,
          preview: conversation.preview,
          time: conversation.time,
          status: conversation.status,
          messages: conversation.messages.map((message) => ({ side: message.side, text: message.text })),
        }))}
        initialConversationId={resolvedSearchParams.conversationId ?? null}
      />
    </InternalPageShell>
  );
}