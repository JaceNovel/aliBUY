import { NextResponse } from "next/server";

import { getSharedCartSummariesForOwner } from "@/lib/cart-share-store";
import { getCurrentUser } from "@/lib/user-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json(await getSharedCartSummariesForOwner(user.id));
}