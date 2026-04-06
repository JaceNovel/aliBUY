import { NextResponse } from "next/server";

import { hasAlibabaPersistentStorage, requiresAlibabaPersistentStorage } from "@/lib/alibaba-operations-store";
import { getConfiguredDatabaseUrlSource, hasConfiguredDatabaseUrl } from "@/lib/prisma";

export function GET() {
  const hasBlobToken = Boolean((process.env.BLOB_READ_WRITE_TOKEN ?? "").trim());
  const hasDatabaseUrl = hasConfiguredDatabaseUrl();

  return NextResponse.json({
    ok: true,
    service: "backend",
    timestamp: new Date().toISOString(),
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      hasBlobReadWriteToken: hasBlobToken,
      hasDatabaseUrl,
      databaseUrlSource: getConfiguredDatabaseUrlSource(),
      hasPersistentStorage: hasAlibabaPersistentStorage(),
      requiresPersistentStorage: requiresAlibabaPersistentStorage(),
    },
  });
}
