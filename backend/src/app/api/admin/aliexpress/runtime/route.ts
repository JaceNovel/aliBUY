import { NextResponse } from "next/server";

import { hasAlibabaPersistentStorage, requiresAlibabaPersistentStorage } from "@/lib/alibaba-operations-store";

export function GET() {
  const hasBlobToken = Boolean((process.env.BLOB_READ_WRITE_TOKEN ?? "").trim());
  const hasDatabaseUrl = Boolean((process.env.DATABASE_URL ?? "").trim());

  return NextResponse.json({
    ok: true,
    service: "backend",
    timestamp: new Date().toISOString(),
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      hasBlobReadWriteToken: hasBlobToken,
      hasDatabaseUrl,
      hasPersistentStorage: hasAlibabaPersistentStorage(),
      requiresPersistentStorage: requiresAlibabaPersistentStorage(),
    },
  });
}
