import { refreshAlibabaOAuthAccessToken } from "@/lib/alibaba-open-platform-client";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const account = await refreshAlibabaOAuthAccessToken({ accountId: id });
    return Response.json({ account });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Refresh token AliExpress impossible.",
    }, { status: 400 });
  }
}