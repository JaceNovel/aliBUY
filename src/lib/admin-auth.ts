import "server-only";

import { cookies } from "next/headers";

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

export function isAdminAuthConfigured() {
  return Boolean(getAdminEmail() && getAdminPasswordHash());
}

export function isAdminEmail(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase() || "";
  return Boolean(normalizedEmail) && normalizedEmail === getAdminEmail();
}

export async function hashAdminPassword(password: string) {
  return sha256Hex(password);
}

export async function getAdminCredentialDiagnostics(email: string, password: string) {
  const submittedEmail = email.trim().toLowerCase();
  const submittedPasswordHash = password ? await hashAdminPassword(password) : "";

  return {
    configured: isAdminAuthConfigured(),
    emailMatch: Boolean(submittedEmail) && submittedEmail === getAdminEmail(),
    hashMatch: Boolean(submittedPasswordHash) && submittedPasswordHash === getAdminPasswordHash(),
  };
}

export async function validateAdminCredentials(email: string, password: string) {
  if (!isAdminAuthConfigured()) {
    throw new Error("Configuration admin incomplète. Définissez ADMIN_EMAIL et ADMIN_PASSWORD_HASH.");
  }

  const diagnostics = await getAdminCredentialDiagnostics(email, password);

  return diagnostics.emailMatch && diagnostics.hashMatch;
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const session = await parseUserSessionToken(cookieStore.get(USER_SESSION_COOKIE)?.value);
  return isAdminEmail(session?.email);
}