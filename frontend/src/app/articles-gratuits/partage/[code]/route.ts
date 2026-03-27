import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { FREE_DEAL_DEVICE_COOKIE, FREE_DEAL_ROUTE } from "@/lib/free-deal-constants";
import { resolveRequestIp } from "@/lib/free-deal-service";
import { recordFreeDealReferralVisit } from "@/lib/free-deal-store";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const [{ code }, cookieStore, headerStore] = await Promise.all([
    context.params,
    cookies(),
    headers(),
  ]);

  const existingDeviceId = cookieStore.get(FREE_DEAL_DEVICE_COOKIE)?.value;
  const deviceId = existingDeviceId ?? crypto.randomUUID();
  const ip = resolveRequestIp(headerStore);
  const userAgent = headerStore.get("user-agent");

  await recordFreeDealReferralVisit({
    referralCode: code,
    visitor: {
      deviceId,
      ip,
      userAgent,
    },
  });

  const response = NextResponse.redirect(new URL(`${FREE_DEAL_ROUTE}?shared=1`, request.url));
  if (!existingDeviceId) {
    response.cookies.set({
      name: FREE_DEAL_DEVICE_COOKIE,
      value: deviceId,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}
