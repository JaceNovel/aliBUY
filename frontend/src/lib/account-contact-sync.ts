import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

import { getAccountSettings, updateAccountSettings } from "@/lib/account-settings-store";
import type { AuthenticatedUser } from "@/lib/user-auth";

function normalizePhone(value?: string | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

type SyncAccountContactInput = {
  phone?: string | null;
  connectedWhatsapp?: string | null;
  usePhoneAsWhatsappByDefault?: boolean;
};

export async function syncUserPhoneChannels(user: AuthenticatedUser, input: SyncAccountContactInput) {
  const currentSettings = await getAccountSettings(user.id);
  const nextPhone = normalizePhone(input.phone) ?? currentSettings.phone;
  const explicitWhatsapp = normalizePhone(input.connectedWhatsapp);
  const nextWhatsapp = explicitWhatsapp
    ?? currentSettings.connectedWhatsapp
    ?? (input.usePhoneAsWhatsappByDefault ? nextPhone : undefined);

  const settings = await updateAccountSettings(user.id, {
    phone: nextPhone,
    connectedWhatsapp: nextWhatsapp,
  });

  if (user.clerkUserId) {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(user.clerkUserId).catch(() => null);
    const currentUnsafeMetadata = clerkUser?.unsafeMetadata && typeof clerkUser.unsafeMetadata === "object"
      ? clerkUser.unsafeMetadata
      : {};

    await client.users.updateUser(user.clerkUserId, {
      unsafeMetadata: {
        ...currentUnsafeMetadata,
        phone: nextPhone ?? null,
        connectedWhatsapp: nextWhatsapp ?? null,
      },
    });
  }

  return settings;
}
