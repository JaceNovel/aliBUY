import { cookies, headers } from "next/headers";

import { FREE_DEAL_DEVICE_COOKIE } from "@/lib/free-deal-constants";
import { resolveRequestIp } from "@/lib/free-deal-service";
import { getFreeDealAccessState, getFreeDealConfig, getFreeDealProducts, getPurchasedFreeDealProductSlugs } from "@/lib/free-deal-store";
import { getCurrentUser } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function GET() {
  const [config, cookieStore, headerStore, user] = await Promise.all([
    getFreeDealConfig(),
    cookies(),
    headers(),
    getCurrentUser(),
  ]);

  const [products, access, claimedProductSlugs] = await Promise.all([
    getFreeDealProducts(config),
    getFreeDealAccessState({
      deviceId: cookieStore.get(FREE_DEAL_DEVICE_COOKIE)?.value,
      ip: resolveRequestIp(headerStore),
      userAgent: headerStore.get("user-agent"),
      userId: user?.id,
      customerEmail: user?.email,
    }, config),
    getPurchasedFreeDealProductSlugs(),
  ]);

  return Response.json({
    config,
    products,
    access: {
      status: access.status,
      referralVisitCount: access.referralVisitCount,
      referralGoal: access.referralGoal,
      sharePath: access.sharePath,
      referralCode: access.claim?.referralCode,
    },
    claimedProductSlugs,
  });
}