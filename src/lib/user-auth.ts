import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { createUserSessionToken, getUserSessionMaxAgeSeconds, parseUserSessionToken, USER_SESSION_COOKIE } from "@/lib/user-session";
import { createStoredUser, getStoredUserByEmail, getStoredUserById, type StoredUser } from "@/lib/user-store";

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  createdAt: string;
};

function toAuthenticatedUser(user: StoredUser): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName,
    createdAt: user.createdAt,
  };
}

function normalizePassword(password: string) {
  return password.trim();
}

export function getUserSessionCookieConfig() {
  return {
    name: USER_SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getUserSessionMaxAgeSeconds(),
  };
}

export function hashUserPassword(password: string, saltHex = randomBytes(16).toString("hex")) {
  const normalizedPassword = normalizePassword(password);
  const passwordHash = scryptSync(normalizedPassword, Buffer.from(saltHex, "hex"), 64).toString("hex");

  return {
    passwordHash,
    passwordSalt: saltHex,
  };
}

function verifyPassword(password: string, user: StoredUser) {
  const { passwordHash } = hashUserPassword(password, user.passwordSalt);
  const expected = Buffer.from(user.passwordHash, "hex");
  const actual = Buffer.from(passwordHash, "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export async function registerUser(input: {
  email: string;
  displayName: string;
  password: string;
}) {
  const password = normalizePassword(input.password);

  if (input.displayName.trim().length < 2) {
    throw new Error("Le nom du compte doit contenir au moins 2 caracteres.");
  }

  if (password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caracteres.");
  }

  const hashedPassword = hashUserPassword(password);
  const user = await createStoredUser({
    email: input.email,
    displayName: input.displayName,
    passwordHash: hashedPassword.passwordHash,
    passwordSalt: hashedPassword.passwordSalt,
  });

  return toAuthenticatedUser(user);
}

export async function validateUserCredentials(email: string, password: string) {
  const user = await getStoredUserByEmail(email);
  if (!user) {
    return null;
  }

  if (!verifyPassword(password, user)) {
    return null;
  }

  return toAuthenticatedUser(user);
}

export async function createAuthenticatedUserSession(user: AuthenticatedUser) {
  return createUserSessionToken({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = await parseUserSessionToken(cookieStore.get(USER_SESSION_COOKIE)?.value);

  if (!session) {
    return null;
  }

  const user = await getStoredUserById(session.sub);
  if (!user) {
    return null;
  }

  return toAuthenticatedUser(user);
}

export async function isUserAuthenticated() {
  return Boolean(await getCurrentUser());
}