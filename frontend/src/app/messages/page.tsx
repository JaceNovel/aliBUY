import { InternalPageShell } from "@/components/internal-page-shell";
import { MessagesClient } from "@/app/messages/messages-client";
import { ensureDefaultSupportConversation, getUserSupportConversations } from "@/lib/customer-data-store";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";

function createGuestConversation() {
  const createdAt = new Date().toISOString();

  return {
    id: "guest-support",
    name: "Support AfriPay",
    email: undefined,
    role: "Assistance generale",
    preview: "Posez votre question, puis connectez-vous si vous voulez garder l'historique.",
    time: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(createdAt)),
    status: "en ligne" as const,
    updatedAt: createdAt,
    messages: [
      {
        id: "guest-support-welcome",
        side: "left" as const,
        text: "Bienvenue sur la messagerie AfriPay. Connectez-vous pour conserver vos conversations et recevoir des reponses reliees a vos commandes.",
        createdAt,
      },
    ],
  };
}

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
  const resolvedConversations = conversations.length > 0
    ? conversations
    : [createGuestConversation()];

  return (
    <InternalPageShell pricing={pricing}>
      <MessagesClient
        conversations={resolvedConversations.map((conversation) => ({
          id: conversation.id,
          name: conversation.name,
          email: conversation.email,
          role: conversation.role,
          preview: conversation.preview,
          time: conversation.time,
          status: conversation.status,
          updatedAt: conversation.updatedAt,
          messages: conversation.messages.map((message) => ({
            id: message.id,
            side: message.side,
            text: message.text,
            createdAt: message.createdAt,
          })),
        }))}
        initialConversationId={resolvedSearchParams.conversationId ?? null}
      />
    </InternalPageShell>
  );
}
