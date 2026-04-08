import "server-only";

import { createClient } from "redis";

type RedisClientInstance = ReturnType<typeof createClient>;

declare global {
  var redisClientPromise: Promise<RedisClientInstance | null> | undefined;
}

async function createRedisClient() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return null;
  }

  const client = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy(retries) {
        return retries > 3 ? false : Math.min(retries * 150, 1_000);
      },
    },
  });

  client.on("error", (error) => {
    console.warn("[redis-cache] client error", error);
  });

  await client.connect();
  return client;
}

async function getRedisClient() {
  if (!globalThis.redisClientPromise) {
    globalThis.redisClientPromise = createRedisClient().catch((error) => {
      console.warn("[redis-cache] unavailable, falling back to origin responses", error);
      globalThis.redisClientPromise = Promise.resolve(null);
      return null;
    });
  }

  return globalThis.redisClientPromise;
}

export async function getRedisJsonCache<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  const value = await client.get(key);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn("[redis-cache] invalid JSON payload", { key, error });
    return null;
  }
}

export async function setRedisJsonCache<T>(key: string, value: T, ttlSeconds: number) {
  const client = await getRedisClient();
  if (!client) {
    return;
  }

  await client.set(key, JSON.stringify(value), {
    EX: ttlSeconds,
  });
}

export async function withRedisJsonCache<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const cachedValue = await getRedisJsonCache<T>(key);
  if (cachedValue !== null) {
    return cachedValue;
  }

  const freshValue = await loader();
  await setRedisJsonCache(key, freshValue, ttlSeconds);
  return freshValue;
}