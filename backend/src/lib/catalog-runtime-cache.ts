type CatalogRuntimeCacheEntry = {
  expiresAt: number;
  value?: unknown;
  promise?: Promise<unknown>;
};

type CatalogRuntimeCacheStore = {
  entries: Map<string, CatalogRuntimeCacheEntry>;
};

declare global {
  var __afripayCatalogRuntimeCache: CatalogRuntimeCacheStore | undefined;
}

function getCatalogRuntimeCacheStore() {
  if (!globalThis.__afripayCatalogRuntimeCache) {
    globalThis.__afripayCatalogRuntimeCache = {
      entries: new Map<string, CatalogRuntimeCacheEntry>(),
    };
  }

  return globalThis.__afripayCatalogRuntimeCache;
}

export async function getOrSetCatalogRuntimeCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const store = getCatalogRuntimeCacheStore();
  const now = Date.now();
  const cached = store.entries.get(key);

  if (cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value as T;
  }

  if (cached?.promise) {
    return cached.promise as Promise<T>;
  }

  const promise = loader()
    .then((value) => {
      store.entries.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      return value;
    })
    .catch((error) => {
      const current = store.entries.get(key);
      if (current?.promise === promise) {
        store.entries.delete(key);
      }
      throw error;
    });

  store.entries.set(key, {
    expiresAt: now + ttlMs,
    promise,
  });

  return promise;
}

export function invalidateCatalogRuntimeCache() {
  getCatalogRuntimeCacheStore().entries.clear();
}
