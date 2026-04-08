import "server-only";

import { cookies } from "next/headers";

import { type AdminPermission, type AdminRole } from "@/lib/admin-access";
import { getAdminAccessByEmail } from "@/lib/admin-access-store";
import { getCurrentUser } from "@/lib/user-auth";
import { parseUserSessionToken, USER_SESSION_COOKIE } from "@/lib/user-session";

function encoder() {
  return new TextEncoder();
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || "";
}

export function getAdminPasswordHash() {
  return process.env.ADMIN_PASSWORD_HASH?.trim() || "";
}

export function getAdminPasswordPlain() {
  return process.env.ADMIN_PASSWORD?.trim() || "";
}

export function isAdminAuthConfigured() {
  return Boolean(getAdminPasswordHash() || getAdminPasswordPlain());
}

export function isAdminEmail(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase() || "";
  return Boolean(normalizedEmail) && normalizedEmail === getAdminEmail();
}

export type AdminAccessContext = {
  email: string;
  role: AdminRole;
  permissions: AdminPermission[];
  active: boolean;
  isSuperAdmin: boolean;
};

export async function getAuthorizedAdminAccessByEmail(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase() || "";
  if (!normalizedEmail) {
    return null;
  }

  if (isAdminEmail(normalizedEmail)) {
    return {
      email: normalizedEmail,
      role: "superadmin",
      permissions: ["dashboard.read", "users.read", "users.manage", "orders.read", "products.read", "products.manage", "promotions.manage", "support.read", "imports.read", "settings.manage", "admin.manage"],
      active: true,
      isSuperAdmin: true,
    } satisfies AdminAccessContext;
  }

  const record = await getAdminAccessByEmail(normalizedEmail);
  if (!record || !record.active) {
    return null;
  }

  return {
    email: record.email,
    role: record.role,
    permissions: record.permissions,
    active: record.active,
    isSuperAdmin: false,
  } satisfies AdminAccessContext;
}

export async function hashAdminPassword(password: string) {
  return sha256Hex(password);
}

export async function getAdminCredentialDiagnostics(email: string, password: string) {
  const submittedEmail = email.trim().toLowerCase();
  const submittedPasswordHash = password ? await hashAdminPassword(password) : "";
  const configuredHash = getAdminPasswordHash();
  const configuredPlain = getAdminPasswordPlain();
  const hashMatch = Boolean(submittedPasswordHash) && (
    submittedPasswordHash === configuredHash
    || password === configuredHash
  );
  const plainMatch = Boolean(password) && password === configuredPlain;

  return {
    configured: isAdminAuthConfigured(),
    emailMatch: Boolean(submittedEmail) && submittedEmail === getAdminEmail(),
    hashMatch,
    plainMatch,
  };
}

export async function validateAdminCredentials(email: string, password: string) {
  if (!isAdminAuthConfigured()) {
    throw new Error("Configuration admin incomplète. Définissez ADMIN_PASSWORD_HASH ou ADMIN_PASSWORD.");
  }

  const diagnostics = await getAdminCredentialDiagnostics(email, password);

  return diagnostics.hashMatch || diagnostics.plainMatch;
}

export async function getCurrentAdminAccess() {
  const cookieStore = await cookies();
  const session = await parseUserSessionToken(cookieStore.get(USER_SESSION_COOKIE)?.value);
  if (session?.email) {
    const sessionAccess = await getAuthorizedAdminAccessByEmail(session.email);
    if (sessionAccess) {
      return sessionAccess;
    }
  }

  const user = await getCurrentUser();
  if (!user?.email) {
    return null;
  }

  return getAuthorizedAdminAccessByEmail(user.email);
}

export async function hasAdminPermission(permission: AdminPermission) {
  const access = await getCurrentAdminAccess();
  return Boolean(access && (access.isSuperAdmin || access.permissions.includes(permission)));
}

export async function isAdminAuthenticated() {
  return Boolean(await getCurrentAdminAccess());
}
