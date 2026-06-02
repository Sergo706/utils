import { MiniCache } from "./miniCache.js";

/**
 * Stores the state for a fixed-window rate limiter key.
 */
export interface Entry {
    /**
     * Number of accepted requests in the active window.
     */
  count: number;

    /**
     * Unix timestamp in milliseconds marking the start of the active window.
     */
  windowStart: number;
};

/**
 * Stores the timestamps tracked for a sliding-window rate limiter key.
 */
export interface RateEntry {
    /**
     * Accepted request timestamps in milliseconds within the active window.
     */
  timestamps: number[];
};

/**
 * Stores the counters used by the sliding-window counter algorithm.
 */
export interface CounterEntry  {
    /**
     * Number of accepted requests in the current time bucket.
     */
  currentBucket: number;

    /**
     * Number of accepted requests in the previous time bucket.
     */
  previousBucket: number;

    /**
     * Unix timestamp in milliseconds marking the start of the current bucket.
     */
  bucketStart: number;
};

/**
 * Configures the internal cache used by the rate limiters.
 */
export interface CacheConfig {
        /**
         * Maximum number of keys retained by the cache before older entries are evicted.
         */
    maxEntries?: number,

        /**
         * Interval in milliseconds used by the cache sweeper to remove expired entries.
         */
    sweepIntervalMs?: number
}


/**
 * Creates a fixed-window rate limiter backed by an in-memory cache.
 *
 * Each key is counted within discrete time windows. Requests are accepted
 * until the limit is reached for the current window, then rejected until the
 * next window starts.
 *
 * @param cache - Cache settings shared by the internal limiter state.
 * @param cache.maxEntries - Optional maximum number of tracked keys.
 * @param cache.sweepIntervalMs - Optional cache cleanup interval in milliseconds.
 * @returns A rate limiter function that returns `true` when a request is allowed and `false` when it is rejected.
 */
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




/**
 * Creates a sliding-window rate limiter backed by an in-memory cache.
 *
 * Each key keeps the timestamps of accepted requests. A request is rejected
 * when the number of timestamps still inside the current window reaches the
 * configured limit.
 *
 * @param cache - Cache settings shared by the internal limiter state.
 * @param cache.maxEntries - Optional maximum number of tracked keys.
 * @param cache.sweepIntervalMs - Optional cache cleanup interval in milliseconds.
 * @returns A rate limiter function that returns `true` when a request is allowed and `false` when it is rejected.
 */
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




/**
 * Creates a sliding-window counter rate limiter backed by an in-memory cache.
 *
 * This algorithm approximates a true sliding window by combining the current
 * bucket count with a weighted portion of the previous bucket count.
 *
 * @param cache - Cache settings shared by the internal limiter state.
 * @param cache.maxEntries - Optional maximum number of tracked keys.
 * @param cache.sweepIntervalMs - Optional cache cleanup interval in milliseconds.
 * @returns A rate limiter function that returns `true` when a request is allowed and `false` when it is rejected.
 */
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