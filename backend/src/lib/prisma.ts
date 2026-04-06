import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

const DATABASE_URL_FALLBACK = "postgresql://afripay:afripay@127.0.0.1:9/afripay?connect_timeout=1";
const DATABASE_URL_WAS_CONFIGURED = Boolean(process.env.DATABASE_URL?.trim());

if (!DATABASE_URL_WAS_CONFIGURED) {
  process.env.DATABASE_URL = DATABASE_URL_FALLBACK;
}

export function hasConfiguredDatabaseUrl() {
  return DATABASE_URL_WAS_CONFIGURED;
}

export const prisma = globalThis.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}