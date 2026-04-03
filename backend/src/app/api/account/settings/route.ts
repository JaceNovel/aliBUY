import { NextResponse } from "next/server";

import { clerkClient } from "@clerk/nextjs/server";

import { getAccountSettings, updateAccountSettings } from "@/lib/account-settings-store";
import { parseDisplayName } from "@/lib/user-session";
import { getCurrentUser } from "@/lib/user-auth";
import { updateStoredUserProfile } from "@/lib/user-store";

type ClerkAccountMetadata = {
  phone?: string;
  connectedWhatsapp?: string;
};

function readClerkAccountMetadata(input: unknown): ClerkAccountMetadata {
  if (!input || typeof input !== "object") {
    return {};
  }

  const candidate = input as Record<string, unknown>;
  return {
    phone: typeof candidate.phone === "string" ? candidate.phone.trim() || undefined : undefined,
    connectedWhatsapp: typeof candidate.connectedWhatsapp === "string" ? candidate.connectedWhatsapp.trim() || undefined : undefined,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const storedSettings = await getAccountSettings(user.id);
  let settings = storedSettings;

  if (user.clerkUserId) {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(user.clerkUserId).catch(() => null);
    const clerkMetadata = readClerkAccountMetadata(clerkUser?.unsafeMetadata);
    const mergedPhone = clerkMetadata.phone ?? storedSettings.phone;
    const mergedWhatsapp = clerkMetadata.connectedWhatsapp ?? storedSettings.connectedWhatsapp;

    if (mergedPhone !== storedSettings.phone || mergedWhatsapp !== storedSettings.connectedWhatsapp) {
      settings = await updateAccountSettings(user.id, {
        phone: mergedPhone,
        connectedWhatsapp: mergedWhatsapp,
      });
    } else {
      settings = {
        ...storedSettings,
        phone: mergedPhone,
        connectedWhatsapp: mergedWhatsapp,
      };
    }
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      firstName: user.firstName,
      createdAt: user.createdAt,
    },
    settings,
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  try {
    const nextPhone = typeof body?.phone === "string" ? body.phone.trim() || undefined : undefined;
    const nextConnectedWhatsapp = typeof body?.connectedWhatsapp === "string" ? body.connectedWhatsapp.trim() || undefined : undefined;

    if (typeof body?.displayName === "string" && body.displayName.trim().length >= 2) {
      if (user.clerkUserId) {
        const parsed = parseDisplayName(body.displayName.trim());
        const [firstName, ...rest] = parsed.displayName.split(" ");
        const client = await clerkClient();
        await client.users.updateUser(user.clerkUserId, {
          firstName: firstName || parsed.firstName,
          lastName: rest.join(" ") || undefined,
        });
      }

      await updateStoredUserProfile({ id: user.id, displayName: body.displayName.trim() });
    }

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
          connectedWhatsapp: nextConnectedWhatsapp ?? null,
        },
      });
    }

    const settings = await updateAccountSettings(user.id, {
      profilePhotoUrl: typeof body?.profilePhotoUrl === "string" ? body.profilePhotoUrl.trim() || undefined : undefined,
      bio: typeof body?.bio === "string" ? body.bio.trim() || undefined : undefined,
      memberRole: typeof body?.memberRole === "string" ? body.memberRole.trim() || undefined : undefined,
      companyName: typeof body?.companyName === "string" ? body.companyName.trim() || undefined : undefined,
      activitySummary: typeof body?.activitySummary === "string" ? body.activitySummary.trim() || undefined : undefined,
      connectedGoogleEmail: typeof body?.connectedGoogleEmail === "string" ? body.connectedGoogleEmail.trim() || undefined : undefined,
      connectedAppleEmail: typeof body?.connectedAppleEmail === "string" ? body.connectedAppleEmail.trim() || undefined : undefined,
      connectedWhatsapp: nextConnectedWhatsapp,
      taxId: typeof body?.taxId === "string" ? body.taxId.trim() || undefined : undefined,
      businessId: typeof body?.businessId === "string" ? body.businessId.trim() || undefined : undefined,
      billingAddress: typeof body?.billingAddress === "string" ? body.billingAddress.trim() || undefined : undefined,
      twoFactorEnabled: body?.twoFactorEnabled === true,
      twoFactorPhone: typeof body?.twoFactorPhone === "string" ? body.twoFactorPhone.trim() || undefined : undefined,
      phone: nextPhone,
      smsSecurityAlerts: body?.smsSecurityAlerts !== false,
      smsOrderUpdates: body?.smsOrderUpdates !== false,
      smsLogisticsReminders: body?.smsLogisticsReminders !== false,
      privacyProfileVisible: body?.privacyProfileVisible !== false,
      privacyActivityVisible: body?.privacyActivityVisible === true,
      privacyPersonalizedData: body?.privacyPersonalizedData !== false,
      emailOrderUpdates: body?.emailOrderUpdates !== false,
      emailMarketing: body?.emailMarketing === true,
      emailWeeklyDigest: body?.emailWeeklyDigest === true,
      adsPersonalized: body?.adsPersonalized !== false,
      adsInterestBased: body?.adsInterestBased !== false,
      adsCampaignFrequency: body?.adsCampaignFrequency === "faible" || body?.adsCampaignFrequency === "elevee" ? body.adsCampaignFrequency : "normale",
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Impossible de mettre a jour ces parametres." }, { status: 400 });
  }
}
