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