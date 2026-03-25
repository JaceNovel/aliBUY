import "server-only";

import { parseDisplayName } from "@/lib/user-session";
import { prisma } from "@/lib/prisma";

export type StoredUser = {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toStoredUser(user: {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName,
    passwordHash: user.passwordHash,
    passwordSalt: user.passwordSalt,
    createdAt: user.createdAt.toISOString(),
  } satisfies StoredUser;
}

export async function getStoredUsers() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  return users.map(toStoredUser);
}

export async function getStoredUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  return user ? toStoredUser(user) : null;
}

export async function getStoredUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toStoredUser(user) : null;
}

export async function createStoredUser(input: {
  email: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
}) {
  const normalizedEmail = normalizeEmail(input.email);

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new Error("Un compte existe deja avec cette adresse e-mail.");
  }

  const name = parseDisplayName(input.displayName);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      displayName: name.displayName,
      firstName: name.firstName,
      passwordHash: input.passwordHash,
      passwordSalt: input.passwordSalt,
    },
  });

  return toStoredUser(user);
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