import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function disableAliExpressAdminApi(context: RouteContext) {
  const { path } = await context.params;
  return NextResponse.json({
    error: true,
    message: "Cet ancien namespace admin est desactive. Utilisez le namespace fournisseur actif.",
    path,
  }, { status: 410, headers: { "x-afripay-admin-proxy": "frontend-aliexpress-disabled" } });
}

export async function GET(request: Request, context: RouteContext) {
  return disableAliExpressAdminApi(context);
}

export async function POST(request: Request, context: RouteContext) {
  return disableAliExpressAdminApi(context);
}

export async function PUT(request: Request, context: RouteContext) {
  return disableAliExpressAdminApi(context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return disableAliExpressAdminApi(context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return disableAliExpressAdminApi(context);
}