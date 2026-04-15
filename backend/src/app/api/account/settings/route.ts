import { NextResponse } from "next/server";

import { getSyncedAccountSettings, persistSyncedAccountSettings } from "@/lib/account-settings";
import { getCurrentUser } from "@/lib/user-auth";

async function requireCurrentUser() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return null;
  }

  return user;
}

export async function GET() {
  const user = await requireCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const settings = await getSyncedAccountSettings(user);

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
  const user = await requireCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ message: "Payload invalide." }, { status: 400 });
  }

  const result = await persistSyncedAccountSettings(user, input);

  return NextResponse.json(
    result.payload ?? { message: "Impossible d'enregistrer ces informations." },
    { status: result.status },
  );
}