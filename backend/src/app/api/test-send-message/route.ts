import { sendMessage } from "@/lib/manychat";

async function readPayload(request: Request) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    return {
      subscriberId: url.searchParams.get("subscriber_id") || "",
      message: url.searchParams.get("message") || "",
      messageTag: url.searchParams.get("message_tag") || undefined,
    };
  }

  const body = await request.json().catch(() => ({}));
  return {
    subscriberId: typeof body?.subscriber_id === "string" ? body.subscriber_id : "",
    message: typeof body?.message === "string" ? body.message : "",
    messageTag: typeof body?.message_tag === "string" ? body.message_tag : undefined,
  };
}

async function handle(request: Request) {
  try {
    const payload = await readPayload(request);
    if (!payload.subscriberId || !payload.message) {
      return Response.json({ message: "subscriber_id et message sont requis." }, { status: 400 });
    }

    const result = await sendMessage(payload.subscriberId, payload.message, payload.messageTag);
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d'envoyer le message ManyChat.";
    return Response.json({ message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
