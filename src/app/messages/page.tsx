import { InternalPageShell } from "@/components/internal-page-shell";
import { MessagesClient } from "@/app/messages/messages-client";
import { getPricingContext } from "@/lib/pricing";

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

  return (
    <InternalPageShell pricing={pricing}>
      <MessagesClient
        initialConversationId={resolvedSearchParams.conversationId ?? null}
        initialOrderId={resolvedSearchParams.orderId ?? null}
        initialTab={resolvedSearchParams.tab === "agents" ? "agents" : "service"}
      />
    </InternalPageShell>
  );
}