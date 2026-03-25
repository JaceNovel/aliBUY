import { NextResponse } from "next/server";

export async function POST(request: Request) {
  void request;
  return NextResponse.json({ message: "Ce point d'accès n'est plus utilisé. Utilisez la page /register avec Clerk." }, { status: 410 });
}