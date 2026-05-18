import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error("Upstash Redis credentials are missing.");
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Create a new rate limiter that allows 5 requests per 1 hour
export const analyzeRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  analytics: true,
  prefix: "@upstash/ratelimit/analyze",
});

export const compareRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  analytics: true,
  prefix: "@upstash/ratelimit/compare",
});
