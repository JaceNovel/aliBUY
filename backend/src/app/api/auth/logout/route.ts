import { NextResponse } from "next/server";

import { validateMutationOrigin } from "@/lib/request-security";
import { getUserSessionCookieConfig } from "@/lib/user-auth";

export async function POST(request: Request) {
  const originError = validateMutationOrigin(request);
  if (originError) {
    return originError;
  }

  const cookieConfig = getUserSessionCookieConfig();
  const response = NextResponse.json({ ok: true });

  response.cookies.set(cookieConfig.name, "", {
    ...cookieConfig,
    maxAge: 0,
  });

  return response;
}
