import { cache } from "react";

import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import { createUserSessionToken, getUserSessionMaxAgeSeconds, parseUserSessionToken, USER_SESSION_COOKIE } from "@/lib/user-session";
import { createStoredUser, getStoredUserByEmail, getStoredUserById, type StoredUser, upsertStoredUserFromClerk } from "@/lib/user-store";

export type AuthenticatedUser = {
  id: string;
  clerkUserId: string | null;
  email: string;
  displayName: string;
  firstName: string;
  createdAt: string;
  authProvider: "clerk" | "legacy";
};

function toAuthenticatedUser(user: StoredUser): AuthenticatedUser {
  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName,
    createdAt: user.createdAt,
    authProvider: user.clerkUserId ? "clerk" : "legacy",
  };
}

function normalizePassword(password: string) {
  return password.trim();
}

function deriveDisplayName(email: string) {
  const [localPart] = email.trim().toLowerCase().split("@");
  if (!localPart) {
    return "Client AfriPay";
  }

  const normalized = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length < 2) {
    return "Client AfriPay";
  }

  return normalized
    .split(" ")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function getPrimaryEmailAddress(clerkUser: {
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
}) {
  return clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)?.emailAddress
    ?? clerkUser.emailAddresses[0]?.emailAddress
    ?? null;
}

function getClerkDisplayName(clerkUser: {
  fullName: string | null;
  firstName: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
  primaryEmailAddressId: string | null;
}) {
  const primaryEmail = getPrimaryEmailAddress(clerkUser);
  return clerkUser.fullName?.trim() || clerkUser.firstName?.trim() || deriveDisplayName(primaryEmail ?? "");
}

function buildTransientClerkUser(input: {
  clerkUserId: string;
  email: string;
  displayName: string;
}): AuthenticatedUser {
  const displayName = input.displayName.trim() || deriveDisplayName(input.email);
  return {
    id: `clerk:${input.clerkUserId}`,
    clerkUserId: input.clerkUserId,
    email: input.email,
    displayName,
    firstName: displayName.split(" ")[0] || "Client",
    createdAt: new Date(0).toISOString(),
    authProvider: "clerk",
  };
}

function buildTransientSessionUser(input: {
  id: string;
  email: string;
  displayName: string;
  createdAt?: string;
}): AuthenticatedUser {
  const displayName = input.displayName.trim() || deriveDisplayName(input.email);
  return {
    id: input.id,
    clerkUserId: null,
    email: input.email.trim().toLowerCase(),
    displayName,
    firstName: displayName.split(" ")[0] || "Client",
    createdAt: input.createdAt ?? new Date(0).toISOString(),
    authProvider: "legacy",
  };
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
  if (!user.passwordHash || !user.passwordSalt) {
    return false;
  }

  const { passwordHash } = hashUserPassword(password, user.passwordSalt);
  const expected = Buffer.from(user.passwordHash, "hex");
  const actual = Buffer.from(passwordHash, "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export async function verifyUserPasswordById(userId: string, password: string) {
  const user = await getStoredUserById(userId);
  if (!user || !user.passwordHash || !user.passwordSalt) {
    return false;
  }

  return verifyPassword(password, user);
}

export async function registerUser(input: {
  email: string;
  displayName?: string;
  password: string;
}) {
  const password = normalizePassword(input.password);
  const displayName = input.displayName?.trim() || deriveDisplayName(input.email);

  if (displayName.length < 2) {
    throw new Error("Le nom du compte doit contenir au moins 2 caracteres.");
  }

  if (password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caracteres.");
  }

  const hashedPassword = hashUserPassword(password);
  const user = await createStoredUser({
    email: input.email,
    displayName,
    passwordHash: hashedPassword.passwordHash,
    passwordSalt: hashedPassword.passwordSalt,
  });

  return toAuthenticatedUser(user);
}

export async function validateUserCredentials(email: string, password: string) {
  const user = await getStoredUserByEmail(email);
  if (!user || !verifyPassword(password, user)) {
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

export const getCurrentUser = cache(async function getCurrentUser() {
  const { userId } = await auth();
  if (userId) {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId).catch(() => null);
    if (clerkUser) {
      const email = getPrimaryEmailAddress(clerkUser);
      if (email) {
        const displayName = getClerkDisplayName(clerkUser);
        const syncedUser = await upsertStoredUserFromClerk({
          clerkUserId: clerkUser.id,
          email,
          displayName,
        }).catch(() => null);

        if (syncedUser) {
          return toAuthenticatedUser(syncedUser);
        }

        return buildTransientClerkUser({
          clerkUserId: clerkUser.id,
          email,
          displayName,
        });
      }
    }
  }

  const cookieStore = await cookies();
  const session = await parseUserSessionToken(cookieStore.get(USER_SESSION_COOKIE)?.value);
  if (!session?.sub) {
    return null;
  }
  const user = await getStoredUserById(session.sub);
  if (!user) {
    return buildTransientSessionUser({
      id: session.sub,
      email: session.email,
      displayName: session.displayName,
    });
  }

  return toAuthenticatedUser(user);
});

export async function isUserAuthenticated() {
  return Boolean(await getCurrentUser());
}
