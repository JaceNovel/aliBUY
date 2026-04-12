import "server-only";

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

export async function getManyChatAdminStatus(): Promise<ManyChatAdminStatus> {
  const accountDiagnostics = await getAccountSettingsDiagnostics();
  const hasApiKey = Boolean(process.env.MANYCHAT_API_KEY?.trim());
  const hasOrderFlowEnv = Boolean(process.env.MANYCHAT_ORDER_CONFIRMATION_FLOW_ID?.trim());
  const hasCartFlowEnv = Boolean(process.env.MANYCHAT_CART_ABANDONED_FLOW_ID?.trim());
  const hasFallbackFlow = accountDiagnostics.anyManyChatFlowConfigured;
  const hasCronSecret = Boolean(process.env.CRON_SECRET?.trim() || process.env.MANYCHAT_CRON_SECRET?.trim());

  return {
    apiKey: hasApiKey
      ? {
          ok: true,
          detail: "Cle API ManyChat detectee sur le runtime frontend.",
        }
      : {
          ok: false,
          detail: "Aucune variable MANYCHAT_API_KEY n'est detectee sur ce runtime frontend.",
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
            detail: "Ni flow paiement global ni fallback de flow ManyChat par compte n'ont ete detectes.",
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
            detail: "Ni flow panier global ni fallback de flow ManyChat par compte n'ont ete detectes.",
          },
    cronRoute: {
      ok: true,
      detail: hasCronSecret
        ? "Route cron presente avec secret detecte pour l'autorisation des appels planifies."
        : process.env.NODE_ENV === "production"
          ? "Route cron presente, mais aucun CRON_SECRET n'est detecte sur ce runtime."
          : "Route cron presente. Hors production, le secret peut etre omis.",
    },
  };
}