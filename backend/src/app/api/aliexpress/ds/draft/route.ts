import {
  buildAliExpressDsDraft,
  runAliExpressDsFreightPrecheck,
  type DraftOrderInput,
} from "../../../../../lib/aliexpress-ds-automation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const order = body && typeof body === "object" ? body as DraftOrderInput : {};
    const draft = buildAliExpressDsDraft(order);
    const freightCheck = await runAliExpressDsFreightPrecheck(order, draft);

    return Response.json({
      draft,
      freight_check: freightCheck,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Generation du draft DS impossible.",
    }, { status: 400 });
  }
}
