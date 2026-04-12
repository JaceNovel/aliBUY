import { NextResponse } from "next/server";

import { processManyChatCartAbandonmentQueue } from "@/lib/manychat";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function isAuthorizedCronRequest(request: Request) {
  const vercelCronHeader = request.headers.get("x-vercel-cron")?.trim();
  if (vercelCronHeader === "1" || vercelCronHeader === "true") {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization")?.trim() || "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (cronSecret && bearerToken && bearerToken === cronSecret) {
    return true;
  }

  return process.env.NODE_ENV !== "production" && !cronSecret;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ message: "Cron authorization failed." }, { status: 401 });
  }

  try {
    const result = await processManyChatCartAbandonmentQueue();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : "ManyChat cron failed.",
    }, { status: 500 });
  }
}