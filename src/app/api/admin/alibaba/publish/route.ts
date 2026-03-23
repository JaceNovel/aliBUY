import { publishImportedProducts } from "@/lib/alibaba-operations-service";

export async function POST(request: Request) {
  const body = await request.json();
  const products = await publishImportedProducts(Array.isArray(body?.productIds) ? body.productIds.map((item: unknown) => String(item)) : []);
  return Response.json({ products });
}
