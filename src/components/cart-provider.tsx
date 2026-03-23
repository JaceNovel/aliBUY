"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { createEmptyQuote, type AlibabaSourcingQuote, type CartInputItem, type SourcingSettings } from "@/lib/alibaba-sourcing";

type CartStateItem = CartInputItem;

type CartContextValue = {
  items: CartStateItem[];
  itemCount: number;
  addItem: (slug: string, quantity: number) => void;
  updateItem: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
  clearCart: () => void;
};

const CART_STORAGE_KEY = "afripay_cart_v1";
const CartContext = createContext<CartContextValue | null>(null);

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
      return parsed.filter((item) => item.slug && item.quantity > 0);
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    addItem(slug, quantity) {
      setItems((current) => {
        const existing = current.find((item) => item.slug === slug);
        if (existing) {
          return current.map((item) => item.slug === slug ? { ...item, quantity: item.quantity + quantity } : item);
        }

        return [...current, { slug, quantity }];
      });
    },
    updateItem(slug, quantity) {
      setItems((current) => quantity <= 0 ? current.filter((item) => item.slug !== slug) : current.map((item) => item.slug === slug ? { ...item, quantity } : item));
    },
    removeItem(slug) {
      setItems((current) => current.filter((item) => item.slug !== slug));
    },
    clearCart() {
      setItems([]);
    },
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }

  return context;
}

export function useCartQuote() {
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
        const response = await fetch("/api/alibaba-sourcing/quote", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ items }),
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
  }, [items]);

  return useMemo(() => ({ quote, settings, isLoading }), [quote, settings, isLoading]);
}