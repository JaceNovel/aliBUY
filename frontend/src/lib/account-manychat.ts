import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

import { getAccountSettings, updateAccountSettings } from "@/lib/account-settings-store";
import type { AuthenticatedUser } from "@/lib/user-auth";

type ManyChatAccountProfile = {
  phone?: string;
  connectedWhatsapp?: string;
  manychatSubscriberId?: string;
  manychatFlowId?: string;
  manychatPaidTagId?: string;
};

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readClerkManyChatMetadata(input: unknown): ManyChatAccountProfile {
  if (!input || typeof input !== "object") {
    return {};
  }

  const candidate = input as Record<string, unknown>;
  return {
    phone: normalizeOptionalString(candidate.phone),
    connectedWhatsapp: normalizeOptionalString(candidate.connectedWhatsapp),
    manychatSubscriberId: normalizeOptionalString(candidate.manychatSubscriberId),
    manychatFlowId: normalizeOptionalString(candidate.manychatFlowId),
    manychatPaidTagId: normalizeOptionalString(candidate.manychatPaidTagId),
  };
}

export async function getManyChatAccountProfile(user: AuthenticatedUser): Promise<ManyChatAccountProfile> {
  const storedSettings = await getAccountSettings(user.id);
  let merged: ManyChatAccountProfile = {
    phone: storedSettings.phone,
    connectedWhatsapp: storedSettings.connectedWhatsapp,
    manychatSubscriberId: storedSettings.manychatSubscriberId,
    manychatFlowId: storedSettings.manychatFlowId,
    manychatPaidTagId: storedSettings.manychatPaidTagId,
  };

  if (!user.clerkUserId) {
    return merged;
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(user.clerkUserId).catch(() => null);
  const clerkMetadata = readClerkManyChatMetadata(clerkUser?.unsafeMetadata);

  merged = {
    phone: clerkMetadata.phone ?? merged.phone,
    connectedWhatsapp: clerkMetadata.connectedWhatsapp ?? merged.connectedWhatsapp,
    manychatSubscriberId: clerkMetadata.manychatSubscriberId ?? merged.manychatSubscriberId,
    manychatFlowId: clerkMetadata.manychatFlowId ?? merged.manychatFlowId,
    manychatPaidTagId: clerkMetadata.manychatPaidTagId ?? merged.manychatPaidTagId,
  };

  if (
    merged.phone !== storedSettings.phone
    || merged.connectedWhatsapp !== storedSettings.connectedWhatsapp
    || merged.manychatSubscriberId !== storedSettings.manychatSubscriberId
    || merged.manychatFlowId !== storedSettings.manychatFlowId
    || merged.manychatPaidTagId !== storedSettings.manychatPaidTagId
  ) {
    await updateAccountSettings(user.id, merged);
  }

  return merged;
}
