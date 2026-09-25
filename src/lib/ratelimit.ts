import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const hasCredentials =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

if (!hasCredentials) {
  console.warn(
    "Upstash Redis credentials are missing. Rate limiting is disabled (all requests allowed).",
  );
}

const redis = hasCredentials
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL as string,
      token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
    })
  : null;

interface RateLimitResult {
  success: true;
  limit: number;
  remaining: number;
  reset: number;
  pending: Promise<unknown>;
}

interface MemoryRateLimitEntry {
  timestamps: number[];
}

function createMemoryFallbackLimit(
  windowLimit: number,
  windowMs: number,
): {
  limit: (identifier: string) => Promise<RateLimitResult>;
} {
  const store = new Map<string, MemoryRateLimitEntry>();

  return {
    limit: async (identifier: string) => {
      const now = Date.now();
      const windowStart = now - windowMs;
      let entry = store.get(identifier);

      if (!entry) {
        entry = { timestamps: [] };
        store.set(identifier, entry);
      }

      entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

      if (entry.timestamps.length < windowLimit) {
        entry.timestamps.push(now);
        const oldest = entry.timestamps[0];
        return {
          success: true,
          limit: windowLimit,
          remaining: windowLimit - entry.timestamps.length,
          reset: Math.floor((oldest + windowMs) / 1000),
          pending: Promise.resolve(),
        };
      } else {
        const oldest = entry.timestamps[0];
        return {
          success: false,
          limit: windowLimit,
          remaining: 0,
          reset: Math.floor((oldest + windowMs) / 1000),
          pending: Promise.resolve(),
        } as unknown as RateLimitResult;
      }
    },
  };
}

function createNoopLimit(): {
  limit: (identifier: string) => Promise<RateLimitResult>;
} {
  return {
    limit: async () => ({
      success: true,
      limit: 999999,
      remaining: 999999,
      reset: Math.floor(Date.now() / 1000) + 3600,
      pending: Promise.resolve(),
    }),
  };
}

function wrapWithFallback(
  redisLimit: Ratelimit,
  windowLimit: number,
  windowMs: number,
  label: string,
): {
  limit: (identifier: string) => Promise<RateLimitResult>;
} {
  const memoryFallback = createMemoryFallbackLimit(windowLimit, windowMs);
  let degradedMode = false;
  let degradedUntil = 0;
  const DEGRADE_DURATION_MS = 60 * 1000;

  return {
    limit: async (identifier: string) => {
      const now = Date.now();
      if (degradedMode && now < degradedUntil) {
        return memoryFallback.limit(identifier);
      }
      if (degradedMode && now >= degradedUntil) {
        degradedMode = false;
      }

      try {
        const result = (await Promise.race([
          redisLimit.limit(identifier),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Redis rate limit timeout")),
              3000,
            ),
          ),
        ])) as unknown as RateLimitResult;
        return result;
      } catch (e) {
        degradedMode = true;
        degradedUntil = Date.now() + DEGRADE_DURATION_MS;
        console.warn(
          `[${label}] Upstash Redis unreachable (${(e as Error).message}). Falling back to in-memory rate limit for ${DEGRADE_DURATION_MS / 1000}s.`,
        );
        return memoryFallback.limit(identifier);
      }
    },
  };
}

const HOUR_MS = 60 * 60 * 1000;

export const analyzeRateLimit =
  hasCredentials && redis
    ? wrapWithFallback(
        new Ratelimit({
          redis: redis,
          limiter: Ratelimit.slidingWindow(5, "1 h"),
          analytics: true,
          prefix: "@upstash/ratelimit/analyze",
        }),
        5,
        HOUR_MS,
        "analyzeRateLimit",
      )
    : createNoopLimit();

export const compareRateLimit =
  hasCredentials && redis
    ? wrapWithFallback(
        new Ratelimit({
          redis: redis,
          limiter: Ratelimit.slidingWindow(10, "1 h"),
          analytics: true,
          prefix: "@upstash/ratelimit/compare",
        }),
        10,
        HOUR_MS,
        "compareRateLimit",
      )
    : createNoopLimit();
