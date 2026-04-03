import { sendFlow } from "@/lib/manychat";

async function readPayload(request: Request) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    return {
      subscriberId: url.searchParams.get("subscriber_id") || "",
      flowId: url.searchParams.get("flow_id") || "",
    };
  }

  const body = await request.json().catch(() => ({}));
  return {
    subscriberId: typeof body?.subscriber_id === "string" ? body.subscriber_id : "",
    flowId: typeof body?.flow_id === "string" ? body.flow_id : "",
  };
}

async function handle(request: Request) {
  try {
    const payload = await readPayload(request);
    if (!payload.subscriberId || !payload.flowId) {
      return Response.json({ message: "subscriber_id et flow_id sont requis." }, { status: 400 });
    }

    const result = await sendFlow(payload.subscriberId, payload.flowId);
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de declencher le flow ManyChat.";
    return Response.json({ message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
