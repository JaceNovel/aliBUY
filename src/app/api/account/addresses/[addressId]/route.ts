import { NextResponse } from "next/server";

import { deleteUserAddress, setUserDefaultAddress, updateUserAddress } from "@/lib/customer-data-store";
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

  return {
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
}

export async function PUT(request: Request, context: { params: Promise<{ addressId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const address = validateAddressPayload(body);
    if (!address.label || !address.recipientName || !address.phone || !address.addressLine1 || !address.city || !address.state || !address.countryCode) {
      throw new Error("Tous les champs obligatoires de l'adresse doivent être renseignés.");
    }

    const { addressId } = await context.params;
    const updatedAddress = await updateUserAddress(user.id, addressId, address);
    return NextResponse.json({ address: updatedAddress });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de modifier l'adresse.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ addressId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    if (body?.action !== "set-default") {
      return NextResponse.json({ message: "Action invalide." }, { status: 400 });
    }

    const { addressId } = await context.params;
    const updatedAddress = await setUserDefaultAddress(user.id, addressId);
    return NextResponse.json({ address: updatedAddress });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de définir l'adresse par défaut.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ addressId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Connexion requise." }, { status: 401 });
  }

  try {
    const { addressId } = await context.params;
    await deleteUserAddress(user.id, addressId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de supprimer l'adresse.";
    return NextResponse.json({ message }, { status: 400 });
  }
}