import "server-only";

import { API_URL, buildApiUrl } from "@/lib/api";
import { getAccountSettings, updateAccountSettings, type AccountSettingsRecord } from "@/lib/account-settings-store";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import type { AuthenticatedUser } from "@/lib/user-auth";

type AccountSettingsApiPayload = {
  settings?: Record<string, unknown>;
  user?: {
    phone?: string | null;
  };
};

function sanitizePartialSettings(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([key]) => key !== "userId" && key !== "updatedAt")) as Partial<Omit<AccountSettingsRecord, "userId" | "updatedAt">>;
}

function mergePayloadIntoSettings(
  userId: string,
  payload: AccountSettingsApiPayload | null,
  fallback: Partial<Omit<AccountSettingsRecord, "userId" | "updatedAt">> = {},
) {
  const settings = payload?.settings && typeof payload.settings === "object" && !Array.isArray(payload.settings)
    ? sanitizePartialSettings(payload.settings)
    : {};

  const userPhone = typeof payload?.user?.phone === "string" ? payload.user.phone.trim() : "";

  return updateAccountSettings(userId, {
    ...fallback,
    ...settings,
    phone: typeof settings.phone === "string" ? settings.phone : userPhone || fallback.phone,
  });
}

export async function getSyncedAccountSettings(user: AuthenticatedUser) {
  const fallbackSettings = await getAccountSettings(user.id);
  const backendAccessToken = API_URL ? await getBackendAccessTokenFromCookies() : "";

  if (!API_URL || !backendAccessToken) {
    return fallbackSettings;
  }

  try {
    const response = await fetch(buildApiUrl("/api/account/settings"), {
      method: "GET",
      headers: await buildServerForwardHeaders({
        accept: "application/json",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return fallbackSettings;
    }

    const payload = await response.json().catch(() => null) as AccountSettingsApiPayload | null;
    return await mergePayloadIntoSettings(user.id, payload, fallbackSettings);
  } catch {
    return fallbackSettings;
  }
}

export async function persistSyncedAccountSettings(
  user: AuthenticatedUser,
  input: Record<string, unknown>,
) {
  const sanitizedInput = sanitizePartialSettings(input);
  const backendAccessToken = API_URL ? await getBackendAccessTokenFromCookies() : "";

  if (!API_URL || !backendAccessToken) {
    const settings = await updateAccountSettings(user.id, sanitizedInput);

    return {
      ok: true as const,
      status: 200,
      payload: { ok: true, settings },
      settings,
    };
  }

  const response = await fetch(buildApiUrl("/api/account/settings"), {
    method: "PATCH",
    headers: await buildServerForwardHeaders({
      accept: "application/json",
      "content-type": "application/json",
    }),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as AccountSettingsApiPayload | null;

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status || 502,
      payload: payload ?? { message: "Impossible d'enregistrer ces informations." },
      settings: null,
    };
  }

  const settings = await mergePayloadIntoSettings(user.id, payload, sanitizedInput);

  return {
    ok: true as const,
    status: response.status || 200,
    payload: {
      ...(payload ?? {}),
      settings,
    },
    settings,
  };
}