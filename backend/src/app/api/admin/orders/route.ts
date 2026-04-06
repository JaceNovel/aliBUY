import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminOrders } from "@/lib/admin-data";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acces refuse." }, { status: 403 });
  }

  const orders = await getAdminOrders({ preferProxy: false });
  return NextResponse.json({ orders });
}