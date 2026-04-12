import "server-only";

import { createHmac } from "node:crypto";

import { buildApiUrl } from "@/lib/api";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getCurrentUser } from "@/lib/user-auth";

export type PartnerPortalStatus = "guest" | "none" | "pending" | "approved" | "rejected";

export type PartnerPortalAccess = {
  status: PartnerPortalStatus;
  hasDashboardAccess: boolean;
  email: string | null;
  request: null | {
    companyName: string;
    website: string | null;
    description: string;
    createdAt: string | null;
  };
  partner: null | {
    id: string;
    companyName: string;
    email: string;
    webhookUrl: string | null;
    isActive: boolean;
    walletBalance: number;
    createdAt: string | null;
  };
};

function getPartnerPortalSecret() {
  return process.env.PARTNER_PORTAL_SHARED_SECRET?.trim() || "";
}

export function buildPartnerPortalHeaders(email: string): Record<string, string> {
  const secret = getPartnerPortalSecret();
  if (!secret) {
    return {};
  }

  const normalizedEmail = email.trim().toLowerCase();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${normalizedEmail}.${timestamp}`).digest("hex");

  return {
    "X-Partner-Portal-Email": normalizedEmail,
    "X-Partner-Portal-Timestamp": timestamp,
    "X-Partner-Portal-Signature": signature,
  };
}

export async function getCurrentPartnerPortalIdentity() {
  const user = await getCurrentUser();
  return user?.email?.trim().toLowerCase() || null;
}

export async function fetchPartnerPortal<T>(path: string, email: string, query?: Record<string, string | number | boolean | null | undefined>): Promise<T> {
  const response = await fetchPartnerPortalResponse(path, email, query);

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : "Partner portal request failed.";
    throw new Error(message);
  }

  return payload as T;
}

export async function fetchPartnerPortalResponse(path: string, email: string, query?: Record<string, string | number | boolean | null | undefined>) {
  const forwardedHeaders = await buildServerForwardHeaders({
    accept: "application/json",
  });

  return fetch(buildApiUrl(path, query), {
    headers: {
      ...Object.fromEntries(forwardedHeaders.entries()),
      ...buildPartnerPortalHeaders(email),
    },
    cache: "no-store",
  });
}

export async function getCurrentPartnerPortalAccess(): Promise<PartnerPortalAccess> {
  const email = await getCurrentPartnerPortalIdentity();
  if (!email) {
    return {
      status: "guest",
      hasDashboardAccess: false,
      email: null,
      request: null,
      partner: null,
    };
  }

  const payload = await fetchPartnerPortal<Omit<PartnerPortalAccess, "email">>("/api/partner/portal/access", email);
  return {
    ...payload,
    email,
  };
}

export async function requireApprovedPartnerPortalAccess() {
  const access = await getCurrentPartnerPortalAccess();
  return access.status === "approved" && access.hasDashboardAccess ? access : null;
}