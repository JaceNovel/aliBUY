import "server-only";

import { access } from "node:fs/promises";
import path from "node:path";

import { getAccountSettingsDiagnostics } from "@/lib/account-settings-store";

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

export async function getManyChatAdminStatus(): Promise<ManyChatAdminStatus> {
  const accountDiagnostics = await getAccountSettingsDiagnostics();
  const hasApiKey = Boolean(process.env.MANYCHAT_API_KEY?.trim());
  const hasOrderFlowEnv = Boolean(process.env.MANYCHAT_ORDER_CONFIRMATION_FLOW_ID?.trim());
  const hasCartFlowEnv = Boolean(process.env.MANYCHAT_CART_ABANDONED_FLOW_ID?.trim());
  const hasFallbackFlow = accountDiagnostics.anyManyChatFlowConfigured;
  const hasCronSecret = Boolean(process.env.CRON_SECRET?.trim() || process.env.MANYCHAT_CRON_SECRET?.trim());
  const hasVercelCron = await hasVercelCronConfigured();

  return {
    apiKey: hasApiKey
      ? {
          ok: true,
          detail: "Cle API ManyChat detectee sur le runtime frontend.",
        }
      : {
          ok: false,
          detail: "Ajoutez MANYCHAT_API_KEY dans les variables d'environnement du service frontend pour activer les appels API ManyChat.",
        },
    orderFlow: hasOrderFlowEnv
      ? {
          ok: true,
          detail: "Flow paiement global detecte via MANYCHAT_ORDER_CONFIRMATION_FLOW_ID.",
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
    cartFlow: hasCartFlowEnv
      ? {
          ok: true,
          detail: "Flow panier abandonne global detecte via MANYCHAT_CART_ABANDONED_FLOW_ID.",
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