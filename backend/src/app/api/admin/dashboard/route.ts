import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acces refuse." }, { status: 403 });
  }

  return NextResponse.json({
    metrics: {
      users: 0,
      orders: 0,
      revenueFcfa: 0,
      products: 0,
      supportConversations: 0,
    },
    monthlyRevenue: [],
    recentOrders: [],
  });
}