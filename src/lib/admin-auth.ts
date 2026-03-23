import "server-only";

import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "afripay_admin_session";

const DEFAULT_ADMIN_EMAIL = "afripay@gmail.com";
const DEFAULT_ADMIN_PASSWORD_HASH = "ab2fd8441f2f7aaf64ccc6a886ff55fb2297ab754b63220b86896a36eab51501";

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
  return process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;
}

export function getAdminPasswordHash() {
  return process.env.ADMIN_PASSWORD_HASH?.trim() || DEFAULT_ADMIN_PASSWORD_HASH;
}

function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.APP_KEY?.trim() || getAdminPasswordHash();
}

export async function hashAdminPassword(password: string) {
  return sha256Hex(password);
}

export async function createAdminSessionToken() {
  return sha256Hex(`${getAdminEmail()}:${getAdminPasswordHash()}:${getAdminSessionSecret()}:afripay-admin`);
}

export async function validateAdminCredentials(email: string, password: string) {
  const submittedEmail = email.trim();
  const submittedPasswordHash = await hashAdminPassword(password);

  return submittedEmail === getAdminEmail() && submittedPasswordHash === getAdminPasswordHash();
}

export async function isValidAdminSessionToken(token?: string | null) {
  if (!token) {
    return false;
  }

  return token === await createAdminSessionToken();
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return isValidAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export function getAdminSessionCookieConfig() {
  return {
    name: ADMIN_SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}