import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/user-auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      displayName: user.displayName,
      firstName: user.firstName,
    },
  });
}