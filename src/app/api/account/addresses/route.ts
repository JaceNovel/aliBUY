import { NextResponse } from "next/server";

import { createUserAddress, getUserAddresses } from "@/lib/customer-data-store";
import { getCurrentUser } from "@/lib/user-auth";

function getStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalStringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getBooleanValue(value: unknown) {
  return value === true;
}

function validateAddressPayload(body: unknown) {
  const payload = typeof body === "object" && body ? body as Record<string, unknown> : null;
  if (!payload) {
    throw new Error("Adresse invalide.");
  }

  const address = {
    label: getStringValue(payload.label),
    recipientName: getStringValue(payload.recipientName),
    phone: getStringValue(payload.phone),
    email: getOptionalStringValue(payload.email),
    addressLine1: getStringValue(payload.addressLine1),
    addressLine2: getOptionalStringValue(payload.addressLine2),
    city: getStringValue(payload.city),
    state: getStringValue(payload.state),
    postalCode: getOptionalStringValue(payload.postalCode),
    countryCode: getStringValue(payload.countryCode),
    isDefault: getBooleanValue(payload.isDefault),
  };

  if (!address.label || !address.recipientName || !address.phone || !address.addressLine1 || !address.city || !address.state || !address.countryCode) {
    throw new Error("Tous les champs obligatoires de l'adresse doivent être renseignés.");
  }

  return address;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  const addresses = await getUserAddresses(user.id);
  return NextResponse.json({ addresses });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const address = validateAddressPayload(body);
    const createdAddress = await createUserAddress(user.id, address);

    return NextResponse.json({ address: createdAddress }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d'enregistrer l'adresse.";
    return NextResponse.json({ message }, { status: 400 });
  }
}