import { NextResponse } from "next/server";

import { getCurrentAdminAccess } from "@/lib/admin-auth";
import { triggerSeaContainerShipment } from "@/lib/sourcing-service";

type RouteContext = {
  params: Promise<{ containerId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const adminAccess = await getCurrentAdminAccess().catch(() => null);
  if (!adminAccess) {
    return NextResponse.json({ message: "Connexion admin requise." }, { status: 401 });
  }

  const { containerId } = await context.params;

  try {
    const result = await triggerSeaContainerShipment(containerId);
    return NextResponse.json({
      message: "Conteneur maritime declenche.",
      ...result,
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Impossible de declencher ce conteneur.",
    }, { status: 422 });
  }
}
