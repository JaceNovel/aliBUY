"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  buildCartItemKey,
  createEmptyQuote,
  normalizeVariantSelection,
  type AlibabaSourcingQuote,
  type CartInputItem,
  type SourcingDeliveryMode,
  type SourcingSettings,
  type VariantSelection,
} from "@/lib/alibaba-sourcing";

type CartStateItem = CartInputItem;

export type SharedCartImportContext = {
  token: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerDisplayName: string;
  message?: string;
  importedAt: string;
};

type CartContextValue = {
  items: CartStateItem[];
  itemCount: number;
  sharedCartContext: SharedCartImportContext | null;
  addItem: (slug: string, quantity: number, selectedVariants?: VariantSelection) => void;
  updateItem: (cartKey: string, quantity: number) => void;
  removeItem: (cartKey: string) => void;
  replaceItems: (nextItems: CartStateItem[]) => void;
  setSharedCartContext: (context: SharedCartImportContext | null) => void;
  clearSharedCartContext: () => void;
  clearCart: () => void;
};

const CART_STORAGE_KEY = "afripay_cart_v1";
const SHARED_CART_STORAGE_KEY = "afripay_cart_shared_v1";
const CartContext = createContext<CartContextValue | null>(null);

function normalizeSharedCartContext(value: unknown): SharedCartImportContext | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.token !== "string"
    || typeof record.ownerUserId !== "string"
    || typeof record.ownerEmail !== "string"
    || typeof record.ownerDisplayName !== "string"
    || typeof record.importedAt !== "string"
  ) {
    return null;
  }

  return {
    token: record.token,
    ownerUserId: record.ownerUserId,
    ownerEmail: record.ownerEmail,
    ownerDisplayName: record.ownerDisplayName,
    message: typeof record.message === "string" ? record.message : undefined,
    importedAt: record.importedAt,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartStateItem[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    try {
      const parsed = JSON.parse(stored) as CartStateItem[];
      return parsed
        .map((item) => ({
          slug: item.slug,
          quantity: item.quantity,
          selectedVariants: normalizeVariantSelection(item.selectedVariants),
        }))
        .filter((item) => item.slug && item.quantity > 0);
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      return [];
    }
  });
  const [sharedCartContext, setSharedCartContextState] = useState<SharedCartImportContext | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const stored = window.localStorage.getItem(SHARED_CART_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    try {
      return normalizeSharedCartContext(JSON.parse(stored));
    } catch {
      window.localStorage.removeItem(SHARED_CART_STORAGE_KEY);
      return null;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (!sharedCartContext) {
      window.localStorage.removeItem(SHARED_CART_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SHARED_CART_STORAGE_KEY, JSON.stringify(sharedCartContext));
  }, [sharedCartContext]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    sharedCartContext,
    addItem(slug, quantity, selectedVariants) {
      const normalizedSelection = normalizeVariantSelection(selectedVariants);
      const cartKey = buildCartItemKey(slug, normalizedSelection);

      setItems((current) => {
        const existing = current.find((item) => buildCartItemKey(item.slug, item.selectedVariants) === cartKey);
        if (existing) {
          return current.map((item) => buildCartItemKey(item.slug, item.selectedVariants) === cartKey
            ? { ...item, quantity: item.quantity + quantity }
            : item);
        }

        return [...current, { slug, quantity, selectedVariants: normalizedSelection }];
      });
    },
    updateItem(cartKey, quantity) {
      setItems((current) => quantity <= 0
        ? current.filter((item) => buildCartItemKey(item.slug, item.selectedVariants) !== cartKey)
        : current.map((item) => buildCartItemKey(item.slug, item.selectedVariants) === cartKey ? { ...item, quantity } : item));
    },
    removeItem(cartKey) {
      setItems((current) => current.filter((item) => buildCartItemKey(item.slug, item.selectedVariants) !== cartKey));
    },
    replaceItems(nextItems) {
      setItems(nextItems.map((item) => ({
        slug: item.slug,
        quantity: item.quantity,
        selectedVariants: normalizeVariantSelection(item.selectedVariants),
      })));
    },
    setSharedCartContext(context) {
      setSharedCartContextState(context);
    },
    clearSharedCartContext() {
      setSharedCartContextState(null);
    },
    clearCart() {
      setItems([]);
      setSharedCartContextState(null);
    },
  }), [items, sharedCartContext]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }

  return context;
}

export function useCartQuote(options?: { disableFreeAir?: boolean; deliveryMode?: SourcingDeliveryMode }) {
  const { items } = useCart();
  const [quote, setQuote] = useState<AlibabaSourcingQuote>(() => createEmptyQuote());
  const [settings, setSettings] = useState<SourcingSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      setQuote(createEmptyQuote());
      return;
    }

    const controller = new AbortController();

    async function loadQuote() {
      setIsLoading(true);

      try {
        const response = await fetch("/api/aliexpress-sourcing/quote", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            items,
            disableFreeAir: options?.disableFreeAir === true,
            deliveryMode: options?.deliveryMode === "forwarder" ? "forwarder" : "direct",
          }),
          signal: controller.signal,
        });
        const payload = await response.json();
        setQuote(payload as AlibabaSourcingQuote);
        setSettings(payload.settings as SourcingSettings);
      } catch {
        if (!controller.signal.aborted) {
          setQuote(createEmptyQuote());
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadQuote();

    return () => {
      controller.abort();
    };
  }, [items, options?.deliveryMode, options?.disableFreeAir]);

  return useMemo(() => ({ quote, settings, isLoading }), [quote, settings, isLoading]);
}