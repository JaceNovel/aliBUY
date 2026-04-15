"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

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

export type SharedCartPreviewItem = {
  slug: string;
  title: string;
  image?: string;
  quantity: number;
  selectedVariants?: VariantSelection;
};

export type SharedCartImportContext = {
  token: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerDisplayName: string;
  message?: string;
  importedAt: string;
  previewItems?: SharedCartPreviewItem[];
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

function buildScopedStorageKey(baseKey: string, ownerScope: string) {
  return `${baseKey}:${ownerScope}`;
}

function readCartItemsFromStorage(storageKey: string): CartStateItem[] {
  const stored = window.localStorage.getItem(storageKey);
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
    window.localStorage.removeItem(storageKey);
    return [];
  }
}

function readSharedCartContextFromStorage(storageKey: string): SharedCartImportContext | null {
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    return null;
  }

  try {
    return normalizeSharedCartContext(JSON.parse(stored));
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

function parseVariantSelection(value: unknown): VariantSelection | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const entries = Object.entries(value).filter(([, entryValue]) => typeof entryValue === "string" && entryValue.trim().length > 0);
  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries) as VariantSelection;
}

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
    previewItems: Array.isArray(record.previewItems)
      ? record.previewItems.flatMap((entry) => {
          if (typeof entry !== "object" || entry === null) {
            return [];
          }

          const preview = entry as Record<string, unknown>;
          if (typeof preview.slug !== "string" || typeof preview.title !== "string") {
            return [];
          }

          return [{
            slug: preview.slug,
            title: preview.title,
            image: typeof preview.image === "string" ? preview.image : undefined,
            quantity: typeof preview.quantity === "number" && preview.quantity > 0 ? preview.quantity : 1,
            selectedVariants: normalizeVariantSelection(parseVariantSelection(preview.selectedVariants)),
          } satisfies SharedCartPreviewItem];
        })
      : undefined,
  };
}

export function CartProvider({ children, ownerScope = "guest" }: { children: React.ReactNode; ownerScope?: string | null }) {
  const cartStorageKey = ownerScope ? buildScopedStorageKey(CART_STORAGE_KEY, ownerScope) : null;
  const sharedCartStorageKey = ownerScope ? buildScopedStorageKey(SHARED_CART_STORAGE_KEY, ownerScope) : null;
  const [items, setItems] = useState<CartStateItem[]>([]);
  const [sharedCartContext, setSharedCartContextState] = useState<SharedCartImportContext | null>(null);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
  const reminderTimerRef = useRef<number | null>(null);
  const syncTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!cartStorageKey || !sharedCartStorageKey || typeof window === "undefined") {
      return;
    }

    setItems(readCartItemsFromStorage(cartStorageKey));
    setSharedCartContextState(readSharedCartContextFromStorage(sharedCartStorageKey));
    setHydratedStorageKey(cartStorageKey);
  }, [cartStorageKey, sharedCartStorageKey]);

  useEffect(() => {
    if (!cartStorageKey || hydratedStorageKey !== cartStorageKey) {
      return;
    }

    window.localStorage.setItem(cartStorageKey, JSON.stringify(items));
  }, [cartStorageKey, hydratedStorageKey, items]);

  useEffect(() => {
    if (!cartStorageKey || !sharedCartStorageKey || hydratedStorageKey !== cartStorageKey) {
      return;
    }

    if (!sharedCartContext) {
      window.localStorage.removeItem(sharedCartStorageKey);
      return;
    }

    window.localStorage.setItem(sharedCartStorageKey, JSON.stringify(sharedCartContext));
  }, [cartStorageKey, hydratedStorageKey, sharedCartContext, sharedCartStorageKey]);

  useEffect(() => {
    if (!cartStorageKey || hydratedStorageKey !== cartStorageKey || typeof window === "undefined") {
      return undefined;
    }

    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    if (reminderTimerRef.current !== null) {
      window.clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }

    const sendCartActivity = async (action: "sync" | "clear", triggerReminderNow = false) => {
      try {
        await fetch("/api/cart/activity", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "include",
          keepalive: action === "clear",
          body: JSON.stringify({
            action,
            items,
            triggerReminderNow,
          }),
        });
      } catch {
        // Intentionally ignore silent sync failures for anonymous users or offline cases.
      }
    };

    if (items.length === 0) {
      void sendCartActivity("clear");
      return undefined;
    }

    syncTimerRef.current = window.setTimeout(() => {
      void sendCartActivity("sync");
    }, 1200);

    reminderTimerRef.current = window.setTimeout(() => {
      void sendCartActivity("sync", true);
    }, 30_000);

    return () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (reminderTimerRef.current !== null) {
        window.clearTimeout(reminderTimerRef.current);
        reminderTimerRef.current = null;
      }
    };
  }, [cartStorageKey, hydratedStorageKey, items]);

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

export function useCartQuote(options?: { disableFreeAir?: boolean; deliveryMode?: SourcingDeliveryMode; countryCode?: string }) {
  const { items } = useCart();
  const [quote, setQuote] = useState<AlibabaSourcingQuote>(() => createEmptyQuote());
  const [settings, setSettings] = useState<SourcingSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastSuccessfulQuoteRef = useRef<AlibabaSourcingQuote>(createEmptyQuote());
  const lastSuccessfulSettingsRef = useRef<SourcingSettings | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      setQuote(createEmptyQuote());
      setSettings(null);
      lastSuccessfulQuoteRef.current = createEmptyQuote();
      lastSuccessfulSettingsRef.current = null;
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
            countryCode: options?.countryCode,
          }),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as (AlibabaSourcingQuote & { settings?: SourcingSettings }) | null;

        if (!response.ok || !payload || !Array.isArray(payload.items) || !Array.isArray(payload.shippingOptions)) {
          throw new Error("Invalid sourcing quote response");
        }

        setQuote(payload);
        setSettings(payload.settings ?? null);
        lastSuccessfulQuoteRef.current = payload;
        lastSuccessfulSettingsRef.current = payload.settings ?? null;
      } catch {
        if (!controller.signal.aborted) {
          setQuote(lastSuccessfulQuoteRef.current);
          setSettings(lastSuccessfulSettingsRef.current);
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
  }, [items, options?.countryCode, options?.deliveryMode, options?.disableFreeAir]);

  return useMemo(() => ({ quote, settings, isLoading }), [quote, settings, isLoading]);
}
