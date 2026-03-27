import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  _context: { params: Promise<{ slug: string }> },
) {
  return new NextResponse(null, { status: 204 });
}
