import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type AdminPermission =
  | "dashboard.read"
  | "users.read"
  | "users.manage"
  | "orders.read"
  | "products.read"
  | "products.manage"
  | "promotions.manage"
  | "support.read"
  | "imports.read"
  | "sourcing.manage"
  | "settings.manage"
  | "admin.manage";

export type AdminRole = "superadmin" | "operations" | "support" | "catalog" | "marketing";

export type AdminAccessRecord = {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  permissions: AdminPermission[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const SITE_DIR = path.join(process.cwd(), "data", "site");
const ACCESS_PATH = path.join(SITE_DIR, "admin-access.json");

export const ADMIN_ROLE_PRESETS: Record<AdminRole, { label: string; permissions: AdminPermission[] }> = {
  superadmin: {
    label: "Superadmin",
    permissions: ["dashboard.read", "users.read", "users.manage", "orders.read", "products.read", "products.manage", "promotions.manage", "support.read", "imports.read", "sourcing.manage", "settings.manage", "admin.manage"],
  },
  operations: {
    label: "Opérations",
    permissions: ["dashboard.read", "users.read", "orders.read", "support.read", "imports.read", "sourcing.manage"],
  },
  support: {
    label: "Support",
    permissions: ["dashboard.read", "users.read", "orders.read", "support.read"],
  },
  catalog: {
    label: "Catalogue",
    permissions: ["dashboard.read", "products.read", "products.manage", "promotions.manage"],
  },
  marketing: {
    label: "Marketing",
    permissions: ["dashboard.read", "products.read", "promotions.manage"],
  },
};

async function ensureSiteDir() {
  await mkdir(SITE_DIR, { recursive: true });
}

async function readRecords() {
  await ensureSiteDir();
  try {
    const raw = await readFile(ACCESS_PATH, "utf8");
    return JSON.parse(raw) as AdminAccessRecord[];
  } catch {
    await writeFile(ACCESS_PATH, "[]\n", "utf8");
    return [] as AdminAccessRecord[];
  }
}

async function writeRecords(records: AdminAccessRecord[]) {
  await ensureSiteDir();
  await writeFile(ACCESS_PATH, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getPermissionsForRole(role: AdminRole) {
  return ADMIN_ROLE_PRESETS[role].permissions;
}

export async function getAdminAccessRecords() {
  const records = await readRecords();
  return [...records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getAdminAccessByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const records = await readRecords();
  return records.find((record) => normalizeEmail(record.email) === normalizedEmail) ?? null;
}

export async function upsertAdminAccess(input: {
  id?: string;
  email: string;
  displayName: string;
  role: AdminRole;
  active: boolean;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const records = await readRecords();
  const existingById = input.id ? records.find((record) => record.id === input.id) : null;
  const existingByEmail = records.find((record) => normalizeEmail(record.email) === normalizedEmail && record.id !== input.id);

  if (existingByEmail) {
    throw new Error("Un accès admin existe déjà pour cette adresse e-mail.");
  }

  const next: AdminAccessRecord = {
    id: existingById?.id ?? randomUUID(),
    email: normalizedEmail,
    displayName: input.displayName.trim() || normalizedEmail,
    role: input.role,
    permissions: getPermissionsForRole(input.role),
    active: input.active,
    createdAt: existingById?.createdAt ?? now,
    updatedAt: now,
  };

  const nextRecords = existingById
    ? records.map((record) => record.id === existingById.id ? next : record)
    : [next, ...records];

  await writeRecords(nextRecords);
  return next;
}

export async function deleteAdminAccess(id: string) {
  const records = await readRecords();
  await writeRecords(records.filter((record) => record.id !== id));
}