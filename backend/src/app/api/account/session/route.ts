import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/user-auth";

export async function GET() {
  const user = await getCurrentUser();

  return NextResponse.json({
    user: user ? {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      firstName: user.firstName,
      authProvider: user.authProvider,
    } : null,
  });
}