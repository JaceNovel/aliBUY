"use client";

import { useAuth } from "@clerk/nextjs";

import { CartProvider } from "@/components/cart-provider";

export function ClerkCartProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const ownerScope = isLoaded && userId ? `clerk:${userId}` : "guest";

  return <CartProvider ownerScope={ownerScope}>{children}</CartProvider>;
}
