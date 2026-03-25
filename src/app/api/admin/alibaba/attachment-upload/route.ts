import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
  uploadAlibabaOrderAttachment,
} from "@/lib/alibaba-open-platform-client";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("data");

    if (!(file instanceof File)) {
      return Response.json({
        message: "Le fichier data est obligatoire.",
      }, { status: 400 });
    }

    const explicitFileName = formData.get("file_name");
    const fileName = typeof explicitFileName === "string" && explicitFileName.trim().length > 0
      ? explicitFileName.trim()
      : file.name;

    const result = await uploadAlibabaOrderAttachment({
      fileName,
      data: await file.arrayBuffer(),
    });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Upload de piece jointe Alibaba impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    const response = result.responseBody && typeof result.responseBody === "object" && !Array.isArray(result.responseBody)
      ? result.responseBody as Record<string, unknown>
      : null;

    return Response.json({
      filePath: typeof response?.value === "string" ? response.value : null,
      responseBody: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Upload de piece jointe Alibaba impossible.",
    }, { status: 400 });
  }
}