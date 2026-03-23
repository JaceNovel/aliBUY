import { getAlibabaReceptionAddresses } from "@/lib/alibaba-operations-store";
import { saveAlibabaReceptionAddressInput } from "@/lib/alibaba-operations-service";

export async function GET() {
  const addresses = await getAlibabaReceptionAddresses();
  return Response.json({ addresses });
}

export async function POST(request: Request) {
  const body = await request.json();
  const address = await saveAlibabaReceptionAddressInput({
    id: body?.id ? String(body.id) : undefined,
    label: String(body?.label ?? ""),
    contactName: String(body?.contactName ?? ""),
    phone: String(body?.phone ?? ""),
    email: String(body?.email ?? ""),
    addressLine1: String(body?.addressLine1 ?? ""),
    addressLine2: body?.addressLine2 ? String(body.addressLine2) : undefined,
    city: String(body?.city ?? ""),
    state: String(body?.state ?? ""),
    postalCode: body?.postalCode ? String(body.postalCode) : undefined,
    countryCode: String(body?.countryCode ?? "CI"),
    port: body?.port ? String(body.port) : undefined,
    portCode: body?.portCode ? String(body.portCode) : undefined,
    isDefault: Boolean(body?.isDefault),
  });

  return Response.json({ address });
}
