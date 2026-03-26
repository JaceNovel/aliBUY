import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ADMIN_ROLE_PRESETS, type AdminAccessRecord, type AdminRole } from "@/lib/admin-access";

function resolveSiteDir() {
  const isServerlessRuntime = Boolean(
    process.env.VERCEL
    || process.env.VERCEL_ENV
    || process.env.VERCEL_URL
    || process.env.AWS_EXECUTION_ENV
    || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );

  if (process.env.NODE_ENV === "production" || isServerlessRuntime) {
    return path.join(os.tmpdir(), "afripay", "data", "site");
  }

  return path.join(process.cwd(), "data", "site");
}

const SITE_DIR = resolveSiteDir();
const ACCESS_PATH = path.join(SITE_DIR, "admin-access.json");

async function ensureSiteDir() {
  await mkdir(SITE_DIR, { recursive: true });
}

async function readRecords() {
  try {
    await ensureSiteDir();
    const raw = await readFile(ACCESS_PATH, "utf8");
    return JSON.parse(raw) as AdminAccessRecord[];
  } catch {
    try {
      await ensureSiteDir();
      await writeFile(ACCESS_PATH, "[]\n", "utf8");
    } catch {
      return [] as AdminAccessRecord[];
    }

    return [] as AdminAccessRecord[];
  }
}

async function writeRecords(records: AdminAccessRecord[]) {
  try {
    await ensureSiteDir();
    await writeFile(ACCESS_PATH, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  } catch {
    // On serverless platforms this storage can be ephemeral or unavailable.
  }
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
