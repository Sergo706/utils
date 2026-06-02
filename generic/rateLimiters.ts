import { MiniCache } from "./miniCache.js";

export interface Entry {
  count: number;
  windowStart: number;
};

export interface RateEntry {
  timestamps: number[];
};

export interface CounterEntry  {
  currentBucket: number;
  previousBucket: number;
  bucketStart: number;
};

export interface CacheConfig {
    maxEntries?: number,
    sweepIntervalMs?: number
}


export function fixedWindowRateLimiter(cache: CacheConfig) {

    const fixedWindowCache = new MiniCache<Entry>(cache.maxEntries, cache.sweepIntervalMs);
    const rateLimiter = (key: string, limit = 50, windowMs = 1000): boolean => {

        const now = Date.now();
        const cached = fixedWindowCache.get(key);

        if (!cached) {
            fixedWindowCache.set(key, { count: 1, windowStart: now }, windowMs);
            return true;
        }

        if (now - cached.windowStart >= windowMs) {
            fixedWindowCache.set(key, { count: 1, windowStart: now }, windowMs);
            return true;
        }
        cached.count += 1;
        return cached.count <= limit;
    };

    return rateLimiter;
}




export function slidingWindowRateLimiter(cache: CacheConfig) {
    
  const slidingWindowCache = new MiniCache<RateEntry>(cache.maxEntries, cache.sweepIntervalMs);

  const rateLimiter = (key: string, limit = 50, windowMs = 1000): boolean => {
    const now = Date.now();
    const windowStart = now - windowMs;

    const entry = slidingWindowCache.get(key) ?? { timestamps: [] };

    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

    if (entry.timestamps.length >= limit) {
        slidingWindowCache.set(key, entry, windowMs);
        return false;
    }

    entry.timestamps.push(now);
    slidingWindowCache.set(key, entry, windowMs);
    return true;
};
    return rateLimiter;
}




export function slidingWindowCounterRateLimiter(cache: CacheConfig) {
  const counters = new MiniCache<CounterEntry>(cache.maxEntries, cache.sweepIntervalMs);

  const rateLimiter = (key: string, limit = 50, windowMs = 1000): boolean => {
        const now = Date.now();
        const currentBucketStart = now - (now % windowMs);

        let entry = counters.get(key);

        entry ??= {
            currentBucket: 0,
            previousBucket: 0,
            bucketStart: currentBucketStart,
            };

        if (entry.bucketStart !== currentBucketStart) {
            const bucketsPassed = Math.floor((currentBucketStart - entry.bucketStart) / windowMs);

            if (bucketsPassed === 1) {
            entry.previousBucket = entry.currentBucket;
            } else {
            entry.previousBucket = 0;
            }

            entry.currentBucket = 0;
            entry.bucketStart = currentBucketStart;
        }

        const elapsed = now - entry.bucketStart;
        const weight = 1 - elapsed / windowMs;

        const estimatedCount = entry.currentBucket + entry.previousBucket * weight;

        if (estimatedCount >= limit) {
            counters.set(key, entry, windowMs);
            return false;
        }

        entry.currentBucket += 1;
        counters.set(key, entry, windowMs);
        return true;
  };
  return rateLimiter;
}