import { NextResponse } from "next/server";

import { getAccountSettings, updateAccountSettings } from "@/lib/account-settings-store";
import { getCurrentUser } from "@/lib/user-auth";
import { updateStoredUserProfile } from "@/lib/user-store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const settings = await getAccountSettings(user.id);
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
    if (typeof body?.displayName === "string" && body.displayName.trim().length >= 2) {
      await updateStoredUserProfile({ id: user.id, displayName: body.displayName.trim() });
    }

    const settings = await updateAccountSettings(user.id, {
      profilePhotoUrl: typeof body?.profilePhotoUrl === "string" ? body.profilePhotoUrl.trim() || undefined : undefined,
      bio: typeof body?.bio === "string" ? body.bio.trim() || undefined : undefined,
      memberRole: typeof body?.memberRole === "string" ? body.memberRole.trim() || undefined : undefined,
      companyName: typeof body?.companyName === "string" ? body.companyName.trim() || undefined : undefined,
      activitySummary: typeof body?.activitySummary === "string" ? body.activitySummary.trim() || undefined : undefined,
      connectedGoogleEmail: typeof body?.connectedGoogleEmail === "string" ? body.connectedGoogleEmail.trim() || undefined : undefined,
      connectedAppleEmail: typeof body?.connectedAppleEmail === "string" ? body.connectedAppleEmail.trim() || undefined : undefined,
      connectedWhatsapp: typeof body?.connectedWhatsapp === "string" ? body.connectedWhatsapp.trim() || undefined : undefined,
      taxId: typeof body?.taxId === "string" ? body.taxId.trim() || undefined : undefined,
      businessId: typeof body?.businessId === "string" ? body.businessId.trim() || undefined : undefined,
      billingAddress: typeof body?.billingAddress === "string" ? body.billingAddress.trim() || undefined : undefined,
      twoFactorEnabled: body?.twoFactorEnabled === true,
      twoFactorPhone: typeof body?.twoFactorPhone === "string" ? body.twoFactorPhone.trim() || undefined : undefined,
      phone: typeof body?.phone === "string" ? body.phone.trim() || undefined : undefined,
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