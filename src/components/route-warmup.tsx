"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const HOT_ROUTES = [
  "/products",
  "/cart",
];

export function RouteWarmup() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const warmRoutes = () => {
      if (cancelled) {
        return;
      }

      HOT_ROUTES.forEach((route) => {
        router.prefetch(route);
      });
    };

    const requestIdle = globalThis.requestIdleCallback;
    if (typeof requestIdle === "function") {
      const idleId = requestIdle(() => warmRoutes(), { timeout: 3000 });
      return () => {
        cancelled = true;
        globalThis.cancelIdleCallback?.(idleId);
      };
    }

    const timeoutId = window.setTimeout(warmRoutes, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [router]);

  return null;
}