export type AdminPartnerRequestStatus = "pending" | "approved" | "rejected" | string;

export type AdminPartnerRequestItem = {
  id: string;
  companyName: string;
  website: string | null;
  email: string;
  description: string;
  status: AdminPartnerRequestStatus;
  createdAt: string | null;
};

export type ApprovedPartnerCredentials = {
  companyName: string;
  email: string;
  appKey: string;
  appSecret: string;
  webhookUrl: string | null;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeAdminPartnerRequestItem(value: unknown): AdminPartnerRequestItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id = normalizeString(candidate.id);
  const companyName = normalizeString(candidate.company_name);
  const email = normalizeString(candidate.email);
  const description = normalizeString(candidate.description);
  const status = normalizeString(candidate.status) || "pending";
  const website = normalizeString(candidate.website) || null;
  const createdAt = normalizeString(candidate.created_at) || null;

  if (!id || !companyName || !email) {
    return null;
  }

  return {
    id,
    companyName,
    website,
    email,
    description,
    status,
    createdAt,
  };
}

export function normalizeAdminPartnerRequests(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AdminPartnerRequestItem[];
  }

  return value
    .map((item) => normalizeAdminPartnerRequestItem(item))
    .filter((item): item is AdminPartnerRequestItem => Boolean(item));
}

export function extractApiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message.trim();
  }

  const errors = candidate.errors;
  if (errors && typeof errors === "object") {
    for (const value of Object.values(errors as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        const firstMessage = value.find((entry) => typeof entry === "string" && entry.trim());
        if (typeof firstMessage === "string") {
          return firstMessage.trim();
        }
      }

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return fallback;
}