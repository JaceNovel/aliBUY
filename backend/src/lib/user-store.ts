import "server-only";

import { parseDisplayName } from "@/lib/user-session";
import { prisma } from "@/lib/prisma";

export type StoredUser = {
  id: string;
  clerkUserId: string | null;
  email: string;
  displayName: string;
  firstName: string;
  passwordHash: string | null;
  passwordSalt: string | null;
  createdAt: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function isPrismaDatabaseUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  return candidate.code === "P1001"
    || message.includes("Environment variable not found: DATABASE_URL")
    || message.includes('error: Environment variable not found: DATABASE_URL')
    || message.includes("Can't reach database server")
    || message.includes("db.prisma.io:5432");
}

function toStoredUser(user: {
  id: string;
  clerkUserId?: string | null;
  email: string;
  displayName: string;
  firstName: string;
  passwordHash?: string | null;
  passwordSalt?: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    clerkUserId: user.clerkUserId ?? null,
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName,
    passwordHash: user.passwordHash ?? null,
    passwordSalt: user.passwordSalt ?? null,
    createdAt: user.createdAt.toISOString(),
  } satisfies StoredUser;
}

export async function getStoredUsers() {
  if (!hasDatabase()) {
    return [];
  }

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } }).catch((error) => {
    if (isPrismaDatabaseUnavailable(error)) {
      return [];
    }

    throw error;
  });
  return users.map(toStoredUser);
}

export async function getStoredUserByEmail(email: string) {
  if (!hasDatabase()) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } }).catch((error) => {
    if (isPrismaDatabaseUnavailable(error)) {
      return null;
    }

    throw error;
  });
  return user ? toStoredUser(user) : null;
}

export async function getStoredUserByClerkUserId(clerkUserId: string) {
  if (!hasDatabase()) {
    return null;
  }

  const user = await prisma.user.findFirst({ where: { clerkUserId } as never }).catch((error) => {
    if (isPrismaDatabaseUnavailable(error)) {
      return null;
    }

    throw error;
  });
  return user ? toStoredUser(user) : null;
}

export async function getStoredUserById(id: string) {
  if (!hasDatabase()) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id } }).catch((error) => {
    if (isPrismaDatabaseUnavailable(error)) {
      return null;
    }

    throw error;
  });
  return user ? toStoredUser(user) : null;
}

export async function createStoredUser(input: {
  email: string;
  displayName: string;
  passwordHash?: string | null;
  passwordSalt?: string | null;
  clerkUserId?: string | null;
}) {
  const normalizedEmail = normalizeEmail(input.email);

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new Error("Un compte existe deja avec cette adresse e-mail.");
  }

  const name = parseDisplayName(input.displayName);
  const user = await prisma.user.create({
    data: {
      clerkUserId: input.clerkUserId ?? null,
      email: normalizedEmail,
      displayName: name.displayName,
      firstName: name.firstName,
      passwordHash: input.passwordHash ?? null,
      passwordSalt: input.passwordSalt ?? null,
    } as never,
  });

  return toStoredUser(user);
}

export async function upsertStoredUserFromClerk(input: {
  clerkUserId: string;
  email: string;
  displayName: string;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  const parsedName = parseDisplayName(input.displayName);

  const existingByClerkUserId = await prisma.user.findFirst({ where: { clerkUserId: input.clerkUserId } as never });
  if (existingByClerkUserId) {
    const updated = await prisma.user.update({
      where: { id: existingByClerkUserId.id },
      data: {
        email: normalizedEmail,
        displayName: parsedName.displayName,
        firstName: parsedName.firstName,
      } as never,
    });

    return toStoredUser(updated);
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingByEmail) {
    const updated = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        clerkUserId: input.clerkUserId,
        displayName: parsedName.displayName,
        firstName: parsedName.firstName,
      } as never,
    });

    return toStoredUser(updated);
  }

  return createStoredUser({
    clerkUserId: input.clerkUserId,
    email: normalizedEmail,
    displayName: parsedName.displayName,
  });
}
export async function updateStoredUserProfile(input: {
  id: string;
  displayName?: string;
}) {
  const current = await prisma.user.findUnique({ where: { id: input.id } });
  if (!current) {
    throw new Error("Utilisateur introuvable.");
  }

  const parsedName = input.displayName ? parseDisplayName(input.displayName) : null;
  const updated = await prisma.user.update({
    where: { id: input.id },
    data: {
      displayName: parsedName?.displayName ?? current.displayName,
      firstName: parsedName?.firstName ?? current.firstName,
    },
  });

  return toStoredUser(updated);
}

export async function updateStoredUserEmail(input: {
  id: string;
  email: string;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing && existing.id !== input.id) {
    throw new Error("Un compte existe deja avec cette adresse e-mail.");
  }

  const updated = await prisma.user.update({
    where: { id: input.id },
    data: { email: normalizedEmail },
  });

  return toStoredUser(updated);
}

export async function updateStoredUserPassword(input: {
  id: string;
  passwordHash: string;
  passwordSalt: string;
}) {
  const updated = await prisma.user.update({
    where: { id: input.id },
    data: {
      passwordHash: input.passwordHash,
      passwordSalt: input.passwordSalt,
    },
  });

  return toStoredUser(updated);
}

export async function deleteStoredUser(id: string) {
  await prisma.user.delete({ where: { id } });
}
