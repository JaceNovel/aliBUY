import { NextResponse } from "next/server";

import { API_URL, buildApiUrl } from "@/lib/api";
import { buildAuthenticatedProxyHeaders } from "@/lib/proxy-auth";

type BackendAuthPayload = {
  user?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
    createdAt?: string;
  };
  token?: string;
  tokenType?: string;
  message?: string;
  errors?: Record<string, string | string[]>;
};

function extractBackendMessage(payload: BackendAuthPayload | null, fallback: string) {
  if (payload?.message && typeof payload.message === "string") {
    return payload.message;
  }

  const firstError = payload?.errors
    ? Object.values(payload.errors).flat().find((value) => typeof value === "string" && value.trim().length > 0)
    : null;

  return firstError || fallback;
}

export function mapBackendUserToSessionIdentity(user: NonNullable<BackendAuthPayload["user"]>) {
  const email = user.email?.trim().toLowerCase() || "";
  const displayName = user.name?.trim() || email.split("@")[0] || "Client AfriPay";

  return {
    id: String(user.id || email || crypto.randomUUID()),
    email,
    displayName,
  };
}

export async function postBackendAuth(
  request: Request,
  path: string,
  payload: Record<string, unknown>,
  actionLabel: string,
) {
  if (!API_URL) {
    return {
      ok: false as const,
      response: NextResponse.json({
        message: `Le storefront ne peut pas ${actionLabel} sans backend externe. Configurez NEXT_PUBLIC_API_BASE_URL avec l'URL de l'API Laravel.`,
      }, { status: 503 }),
    };
  }

  const headers = await buildAuthenticatedProxyHeaders(request, {
    accept: "application/json",
    "content-type": "application/json",
  });

  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null) as BackendAuthPayload | null;
  if (!response.ok || !body?.user) {
    return {
      ok: false as const,
      response: NextResponse.json({
        message: extractBackendMessage(body, `Impossible de ${actionLabel}.`),
      }, { status: response.status || 502 }),
    };
  }

  return {
    ok: true as const,
    body,
  };
}

export async function provisionBackendGoogleUser(request: Request, input: { email: string; displayName: string }) {
  const password = `${crypto.randomUUID()}Aa1!`;
  const result = await postBackendAuth(request, "/api/auth/register", {
    name: input.displayName,
    email: input.email,
    password,
    password_confirmation: password,
  }, "créer le compte Google");

  return result.ok ? result.body : null;
}