import type { PrismaClient } from "@/lib/prisma-shim";

export function hasConfiguredDatabaseUrl(): boolean {
  return false;
}

export function getConfiguredDatabaseUrl(): string | null {
  return null;
}

export function getConfiguredDatabaseUrlSource(): string | null {
  return null;
}

const prismaDisabledProxy = new Proxy({}, {
  get(_target, property) {
    throw new Error(`Prisma est desactive sur le frontend. Acces interdit a prisma.${String(property)}. Utilisez le backend Laravel.`);
  },
});

export const prisma = prismaDisabledProxy as unknown as PrismaClient;
