import { processManyChatCartAbandonmentQueue } from "@/lib/manychat";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.MANYCHAT_CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization")?.trim();
  if (authorization === `Bearer ${secret}`) {
    return true;
  }

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processManyChatCartAbandonmentQueue();
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de traiter les relances panier ManyChat.";
    return Response.json({ message }, { status: 500 });
  }
}
