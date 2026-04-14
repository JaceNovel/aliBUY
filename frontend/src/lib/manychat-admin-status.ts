import "server-only";

import { access } from "node:fs/promises";
import path from "node:path";

import { getAccountSettingsDiagnostics } from "@/lib/account-settings-store";
import { API_URL } from "@/lib/api";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

type ManyChatStatusCard = {
  ok: boolean;
  detail: string;
};

export type ManyChatAdminStatus = {
  apiKey: ManyChatStatusCard;
  orderFlow: ManyChatStatusCard;
  cartFlow: ManyChatStatusCard;
  cronRoute: ManyChatStatusCard;
};

async function hasVercelCronConfigured() {
  try {
    await access(path.join(process.cwd(), "vercel.json"));
    return true;
  } catch {
    return false;
  }
}

async function getBackendManyChatDiagnostics() {
  if (!API_URL) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/diagnostics/manychat`, {
      headers: await buildServerForwardHeaders({
        accept: "application/json",
      }, {
        includeAdminApiToken: true,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null) as {
      manychat?: {
        apiKey?: boolean;
        orderFlow?: boolean;
        cartFlow?: boolean;
      };
    } | null;

    return payload?.manychat ?? null;
  } catch {
    return null;
  }
}

export async function getManyChatAdminStatus(): Promise<ManyChatAdminStatus> {
  const [accountDiagnostics, backendDiagnostics] = await Promise.all([
    getAccountSettingsDiagnostics(),
    getBackendManyChatDiagnostics(),
  ]);
  const hasApiKey = Boolean(process.env.MANYCHAT_API_KEY?.trim());
  const hasOrderFlowEnv = Boolean(process.env.MANYCHAT_ORDER_CONFIRMATION_FLOW_ID?.trim());
  const hasCartFlowEnv = Boolean(process.env.MANYCHAT_CART_ABANDONED_FLOW_ID?.trim());
  const hasAnyApiKey = hasApiKey || Boolean(backendDiagnostics?.apiKey);
  const hasAnyOrderFlow = hasOrderFlowEnv || Boolean(backendDiagnostics?.orderFlow);
  const hasAnyCartFlow = hasCartFlowEnv || Boolean(backendDiagnostics?.cartFlow);
  const hasFallbackFlow = accountDiagnostics.anyManyChatFlowConfigured;
  const hasCronSecret = Boolean(process.env.CRON_SECRET?.trim() || process.env.MANYCHAT_CRON_SECRET?.trim());
  const hasVercelCron = await hasVercelCronConfigured();

  return {
    apiKey: hasAnyApiKey
      ? {
          ok: true,
          detail: hasApiKey ? "Cle API ManyChat detectee sur le runtime frontend." : "Cle API ManyChat detectee sur le backend Laravel.",
        }
      : {
          ok: false,
          detail: "Ajoutez MANYCHAT_API_KEY dans les variables d'environnement du service frontend pour activer les appels API ManyChat.",
        },
    orderFlow: hasAnyOrderFlow
      ? {
          ok: true,
          detail: hasOrderFlowEnv ? "Flow paiement global detecte via MANYCHAT_ORDER_CONFIRMATION_FLOW_ID." : "Flow paiement global detecte cote backend Laravel.",
        }
      : hasFallbackFlow
        ? {
            ok: true,
            detail: "Aucun flow global, mais au moins un flow ManyChat est detecte dans les donnees compte client.",
          }
        : {
            ok: false,
            detail: "Ajoutez MANYCHAT_ORDER_CONFIRMATION_FLOW_ID ou renseignez manychatFlowId sur les comptes qui doivent recevoir le flow paiement.",
          },
    cartFlow: hasAnyCartFlow
      ? {
          ok: true,
          detail: hasCartFlowEnv ? "Flow panier abandonne global detecte via MANYCHAT_CART_ABANDONED_FLOW_ID." : "Flow panier abandonne detecte cote backend Laravel.",
        }
      : hasFallbackFlow
        ? {
            ok: true,
            detail: "Le flow panier peut s'appuyer sur les flows ManyChat rattaches aux comptes clients.",
          }
        : {
            ok: false,
            detail: "Ajoutez MANYCHAT_CART_ABANDONED_FLOW_ID ou renseignez manychatFlowId sur les comptes utilises pour les relances panier/devis.",
          },
    cronRoute: {
      ok: true,
      detail: hasCronSecret
        ? "Route cron presente avec secret detecte pour l'autorisation des appels planifies."
        : hasVercelCron
          ? "Route cron presente et planification Vercel detectee via vercel.json. Le secret n'est pas requis pour les appels x-vercel-cron."
        : process.env.NODE_ENV === "production"
          ? "Route cron presente, mais aucun CRON_SECRET n'est detecte sur ce runtime."
          : "Route cron presente. Hors production, le secret peut etre omis.",
    },
  };
}
