import { PrismaClient } from "@prisma/client";

declare global {
  var backendPrismaGlobal: PrismaClient | undefined;
}

const DATABASE_URL_ENV_KEYS = [
  "DATABASE_URL",
  "PRISMA_DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
] as const;

const DATABASE_URL_FALLBACK = "postgresql://afripay:afripay@127.0.0.1:9/afripay?connect_timeout=1";

function findConfiguredDatabaseUrl() {
  for (const key of DATABASE_URL_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      return { key, value };
    }
  }

  return null;
}

const CONFIGURED_DATABASE_URL = findConfiguredDatabaseUrl();
const DATABASE_URL_WAS_CONFIGURED = Boolean(CONFIGURED_DATABASE_URL?.value);

if (!DATABASE_URL_WAS_CONFIGURED) {
  process.env.DATABASE_URL = DATABASE_URL_FALLBACK;
} else if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = CONFIGURED_DATABASE_URL?.value;
}

export function hasConfiguredDatabaseUrl() {
  return DATABASE_URL_WAS_CONFIGURED;
}

export function getConfiguredDatabaseUrl() {
  return CONFIGURED_DATABASE_URL?.value ?? null;
}

export function getConfiguredDatabaseUrlSource() {
  return CONFIGURED_DATABASE_URL?.key ?? null;
}

export const prisma = globalThis.backendPrismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.backendPrismaGlobal = prisma;
}
