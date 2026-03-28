import { NextResponse } from "next/server";

import { getAdminMetrics, getAdminMonthlyRevenue, getAdminRecentOrders } from "@/lib/admin-data";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acces refuse." }, { status: 403 });
  }

  const [metrics, monthlyRevenue, recentOrders] = await Promise.all([
    getAdminMetrics(),
    getAdminMonthlyRevenue(),
    getAdminRecentOrders(5),
  ]);

  return NextResponse.json({ metrics, monthlyRevenue, recentOrders });
}