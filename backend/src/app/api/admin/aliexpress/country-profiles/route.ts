import { getAlibabaCountryProfiles } from "@/lib/alibaba-operations-store";
import { saveAlibabaCountryProfilesInput } from "@/lib/alibaba-operations-service";

export async function GET() {
  const profiles = await getAlibabaCountryProfiles();
  return Response.json({ profiles });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const profiles = await saveAlibabaCountryProfilesInput(Array.isArray(body?.profiles) ? body.profiles : []);
  return Response.json({ profiles });
}
