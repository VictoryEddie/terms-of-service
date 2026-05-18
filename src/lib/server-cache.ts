import { LRUCache } from "lru-cache";
import { redis } from "./redis";

// Define proper type for cached values
export interface CachedAnalysisResult {
  isTermsOfService: boolean;
  appName?: string;
  transparencyScore?: number;
  grade?: string;
  summary: string;
  risks: unknown[];
  goodPoints: unknown[];
  timeSavedMinutes?: number;
  smokingGun?: unknown;
  jurisdiction?: string;
  contentHash?: string;
  previousVersionId?: string | null;
  analysisSource?: "link" | "text";
  sourceUrl?: string | null;
  [key: string]: unknown; // Allow additional properties
}

// High-speed in-memory cache for the server (L1)
const options = {
  max: 500,
  ttl: 1000 * 60 * 60 * 24, // 24 hours
};

const globalForCache = global as unknown as { localCache: LRUCache<string, CachedAnalysisResult> };
const localCache = globalForCache.localCache || new LRUCache<string, CachedAnalysisResult>(options);

if (process.env.NODE_ENV !== "production") {
  globalForCache.localCache = localCache;
}

/**
 * Hybrid Caching System
 * L1: Local Memory (Sync, fastest)
 * L2: Upstash Redis (Async, persistent)
 */
export const serverCache = {
  async get(key: string): Promise<CachedAnalysisResult | null> {
    // 1. Check L1 (Memory)
    const memoryHit = localCache.get(key);
    if (memoryHit) return memoryHit;

    // 2. Check L2 (Redis)
    try {
      const redisHit = await redis.get<CachedAnalysisResult>(key);
      if (redisHit) {
        // Hydrate L1
        localCache.set(key, redisHit);
        return redisHit;
      }
    } catch (e) {
      console.error("Redis Get Error:", e);
    }

    return null;
  },

  async set(key: string, value: CachedAnalysisResult): Promise<void> {
    // 1. Set L1
    localCache.set(key, value);

    // 2. Set L2 (Redis)
    try {
      await redis.set(key, value, { ex: 60 * 60 * 24 * 7 }); // Keep for 7 days in Redis
    } catch (e) {
      console.error("Redis Set Error:", e);
    }
  }
};
