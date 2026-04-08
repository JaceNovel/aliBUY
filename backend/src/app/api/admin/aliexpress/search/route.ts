import { maybeProxyAliExpressAdminRequest } from "@/app/api/admin/aliexpress/proxy";
import { previewAliExpressDsTextSearch } from "@/lib/alibaba-open-platform-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const proxiedResponse = await maybeProxyAliExpressAdminRequest({
      request,
      path: "/api/admin/aliexpress/search",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (proxiedResponse) {
      return proxiedResponse;
    }

    const result = await previewAliExpressDsTextSearch({
      query: String(body?.query ?? body?.keyword ?? body?.keyWord ?? ""),
      local: body?.local,
      countryCode: body?.countryCode ?? body?.country_code ?? body?.shipToCountry ?? body?.ship_to_country,
      categoryId: body?.categoryId ?? body?.category_id,
      sortBy: body?.sortBy ?? body?.sort_by,
      pageSize: body?.pageSize ?? body?.page_size,
      pageIndex: body?.pageIndex ?? body?.page_index,
      currency: body?.currency,
      selectionName: body?.selectionName ?? body?.selection_name,
      searchExtend: body?.searchExtend ?? body?.search_extend,
      supplierAccountId: body?.supplierAccountId ?? body?.supplier_account_id,
    });

    if (!result.ok) {
      return Response.json({
        message: result.errorMessage ?? "Recherche AliExpress DS impossible.",
        errorCode: result.errorCode,
        requestId: result.requestId,
        totalCount: result.totalCount,
        pageIndex: result.pageIndex,
        pageSize: result.pageSize,
      }, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Recherche AliExpress DS impossible.",
    }, { status: 400 });
  }
}