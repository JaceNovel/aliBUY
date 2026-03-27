import { getAlibabaReceptionRecords } from "@/lib/alibaba-operations-store";

export async function GET() {
  const receptions = await getAlibabaReceptionRecords();
  return Response.json({ receptions });
}
