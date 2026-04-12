import { AdminPartnerRequestsClient } from "@/components/admin-partner-requests-client";
import { normalizeAdminPartnerRequests } from "@/lib/admin-partner-requests";
import { API_URL } from "@/lib/api";
import { getManyChatAdminStatus } from "@/lib/manychat-admin-status";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getPartnerRequests() {
  if (!API_URL) {
    return {
      items: [],
      warning: "Le backend Laravel n'est pas configure sur ce frontend, les demandes partenaire ne peuvent pas etre chargees.",
    };
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/partner-requests`, {
      headers: await buildServerForwardHeaders({
        accept: "application/json",
      }, {
        includeAdminApiToken: true,
      }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null) as { items?: unknown[]; message?: string } | null;
    if (!response.ok) {
      return {
        items: [],
        warning: payload?.message || `Le backend a renvoye HTTP ${response.status} lors du chargement des demandes partenaire.`,
      };
    }

    return {
      items: normalizeAdminPartnerRequests(payload?.items),
      warning: null,
    };
  } catch {
    return {
      items: [],
      warning: "Impossible de joindre le backend Laravel pour charger les demandes partenaire.",
    };
  }
}

export default async function AdminPartnerRequestsPage() {
  const { items, warning } = await getPartnerRequests();
  const manyChatStatus = await getManyChatAdminStatus();

  return (
    <AdminPartnerRequestsClient
      initialRequests={items}
      warning={warning}
      manyChatStatus={manyChatStatus}
    />
  );
}