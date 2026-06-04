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
 * Configures the internal cache and optional ban policy shared by all rate limiter variants.
 *
 * Cache settings (`maxEntries`, `sweepIntervalMs`) control the underlying
 * {@link MiniCache} instances that store rate-limit state **and** ban state.
 *
 * Ban settings (`enableBans`, `allowedAttemptsBeforeBan`, `banMultiplier`)
 * are only effective when `enableBans` is `true`. When enabled, each
 * rate-limited rejection increments a per-key violation counter. Once the
 * counter reaches `allowedAttemptsBeforeBan`, the key is banned for
 * `violations * windowMs * banMultiplier` milliseconds and the violation
 * counter resets to `0`. The ban duration is therefore constant per cycle
 * (always `allowedAttemptsBeforeBan * windowMs * banMultiplier`).
 */
export interface CacheConfig {
        /**
         * Maximum number of keys retained by the cache before older entries are evicted.
         */
    maxEntries?: number,

        /**
         * Interval in milliseconds used by the cache sweeper to remove expired entries.
         */
    sweepIntervalMs?: number,

        /**
         * When `true`, keys that repeatedly exceed the rate limit are temporarily
         * banned after {@link allowedAttemptsBeforeBan} consecutive violations.
         *
         * While a key is banned every call is short-circuited immediately
         * without touching the main rate-limit cache.
         *
         * @default false
         */
    enableBans?: boolean;

        /**
         * Number of consecutive rate-limit rejections (violations) required
         * before a ban is applied. A successful (allowed) request resets the
         * violation counter back to `0`.
         *
         * Only meaningful when {@link enableBans} is `true`.
         *
         * @default 3
         */
    allowedAttemptsBeforeBan?: number;

        /**
         * Multiplier applied when calculating ban duration.
         *
         * `banDuration = violations * windowMs * banMultiplier`
         *
         * Because violations always equal {@link allowedAttemptsBeforeBan} at
         * the moment the ban fires, the effective duration per ban cycle is
         * `allowedAttemptsBeforeBan * windowMs * banMultiplier`.
         *
         * Only meaningful when {@link enableBans} is `true`.
         *
         * @default 2
         */
    banMultiplier?: number;
    /**
     * Multiplier used to calculate the "cooldown" period.
     * If a user survives for `banDuration * penaltyCooldownMultiplier` without
     * getting banned again, their penalty tier resets to 0.
     * @default 5
     */
    penaltyCooldownMultiplier?: number;
}

/**
 * Result returned by every rate limiter invocation.
 *
 * Callers should inspect `allowed` first. When `false`, `retryAfterMs`
 * indicates how long to wait (for an HTTP `Retry-After` header)
 * and `remainingPoints` is always `0`.
 */
export interface RateLimitResult {
    /** Whether the request is allowed through the rate limiter. */
    allowed: boolean;

    /**
     * Milliseconds the caller should wait before retrying.
     *
     * - **Banned**: remaining ban duration.
     * - **Rate-limited (not banned)**: approximate time until the current window reopens.
     * - **Allowed**: `0`.
     */
    retryAfterMs: number;

    /**
     * Number of requests the caller can still make in the current window.
     * Always `0` when the request is rejected or the key is banned.
     */
    remainingPoints: number;
}

/**
 * Internal entry stored in the bans cache, tracking the absolute
 * timestamp (ms) at which the ban expires.
 */
interface BanEntry {
    /** Unix timestamp in milliseconds when the ban expires. */
    expiresAt: number;
}

/**
 * Creates a shared ban-handling helper used by all rate limiter variants.
 *
 * The handler tracks consecutive violations per key. Once the violation
 * count reaches {@link CacheConfig.allowedAttemptsBeforeBan | allowedAttemptsBeforeBan},
 * the key is banned for `violations * windowMs * banMultiplier` milliseconds.
 *
 * Violations reset to `0` in two cases:
 * 1. A ban is applied (the counter is consumed).
 * 2. A successful (allowed) request is recorded via {@link resetViolations}.
 *
 * Because the counter always equals `allowedAttemptsBeforeBan` at the moment
 * a ban fires, every ban cycle produces the same duration.
 *
 * All methods are no-ops when {@link CacheConfig.enableBans | enableBans} is `false`.
 *
 * @param cache - The shared {@link CacheConfig} from the parent rate limiter.
 * @returns An object with `checkBan`, `recordViolation`, and `resetViolations` methods.
 */
function createBanHandler(cache: CacheConfig) {
    const enabled = cache.enableBans ?? false;
    const maxViolations = cache.allowedAttemptsBeforeBan ?? 3;
    const multiplier = cache.banMultiplier ?? 2;
    const cooldownMultiplier = cache.penaltyCooldownMultiplier ?? 5;

    const violationsCache = new MiniCache<number>(cache.maxEntries, cache.sweepIntervalMs);
    const bansCache = new MiniCache<BanEntry>(cache.maxEntries, cache.sweepIntervalMs);
    const tierCache = new MiniCache<number>(cache.maxEntries, cache.sweepIntervalMs);

    return {
        /**
         * Checks whether `key` is currently banned.
         *
         * @param key - The rate-limit key to check.
         * @returns Remaining ban time in milliseconds, or `0` if not banned.
         */
        checkBan(key: string): number {
            if (!enabled) return 0;
            const ban = bansCache.get(key);
            if (!ban) return 0;
            const remaining = ban.expiresAt - Date.now();
            if (remaining <= 0) {
                bansCache.del(key);
                return 0;
            }
            return remaining;
        },
 
        /**
         * Records a rate-limit violation for `key` and applies a ban when
         * the violation count reaches the configured threshold.
         *
         * When a ban is applied the violation counter is deleted so the
         * next cycle starts from `0`.
         *
         * @param key - The rate-limit key that was rejected.
         * @param windowMs - The window size passed to the rate limiter call,
         *                   used to compute ban duration.
         * @returns Full ban duration in milliseconds if a ban was applied, `0` otherwise.
         */
        recordViolation(key: string, windowMs: number): number {
            if (!enabled) return 0;
            const violations = (violationsCache.get(key) ?? 0) + 1;

            violationsCache.set(key, violations, windowMs * multiplier * (maxViolations + 1));
            
            if (violations >= maxViolations) {
                const currentTier = (tierCache.get(key) ?? 0) + 1;
                const baseDuration = windowMs * maxViolations;
                const banDuration = baseDuration * Math.pow(multiplier, currentTier);
                
                bansCache.set(key, { expiresAt: Date.now() + banDuration }, banDuration);
                const cooldownTime = banDuration * cooldownMultiplier;
                tierCache.set(key, currentTier, banDuration + cooldownTime);

                violationsCache.del(key);
                return banDuration;
            }
            return 0;
        },

        /**
         * Resets the violation counter for `key` back to `0`.
         *
         * Called by each rate limiter when a request is allowed, so that a
         * single successful request breaks the consecutive-violation streak.
         *
         * @param key - The rate-limit key that was allowed.
         */
        resetViolations(key: string): void {
            if (!enabled) return;
            violationsCache.del(key);
        },
    };
}


/**
 * Creates a fixed-window rate limiter backed by an in-memory cache.
 *
 * Each key is counted within discrete time windows anchored to the first
 * request. Requests are accepted until the count reaches `limit`, then
 * rejected until the window expires.
 *
 * When {@link CacheConfig.enableBans | enableBans} is `true`, a banned key
 * is short-circuited before the window logic runs — the ban's remaining
 * time is returned as `retryAfterMs`.
 *
 * @param cache - Cache and ban policy configuration.
 * @returns A function `(key: string, limit?: number, windowMs?: number) => RateLimitResult`.
 */
export function fixedWindowRateLimiter(cache: CacheConfig) {

    const fixedWindowCache = new MiniCache<Entry>(cache.maxEntries, cache.sweepIntervalMs);
    const banHandler = createBanHandler(cache);
    
    const rateLimiter = (key: string, limit = 50, windowMs = 1000): RateLimitResult => {

        const banRemaining = banHandler.checkBan(key);
        if (banRemaining > 0) {
            return { allowed: false, retryAfterMs: banRemaining, remainingPoints: 0 };
        }

        const now = Date.now();
        const cached = fixedWindowCache.get(key);

        if (!cached) {
            fixedWindowCache.set(key, { count: 1, windowStart: now }, windowMs);
            banHandler.resetViolations(key);
            return { allowed: true, retryAfterMs: 0, remainingPoints: limit - 1 };
        }

        if (now - cached.windowStart >= windowMs) {
            fixedWindowCache.set(key, { count: 1, windowStart: now }, windowMs);
            banHandler.resetViolations(key);
            return { allowed: true, retryAfterMs: 0, remainingPoints: limit - 1 };
        }

        cached.count += 1;

        if (cached.count > limit) {
            const banDuration = banHandler.recordViolation(key, windowMs);
            const retryAfterMs = Math.max(0, banDuration > 0 ? banDuration : (cached.windowStart + windowMs) - now);
            return { allowed: false, retryAfterMs, remainingPoints: 0 };
        }

        banHandler.resetViolations(key);
        return { allowed: true, retryAfterMs: 0, remainingPoints: limit - cached.count };
    };

    return rateLimiter;
}




/**
 * Creates a sliding-window rate limiter backed by an in-memory cache.
 *
 * Each key stores the timestamps of accepted requests. On every call,
 * timestamps older than `windowMs` are pruned. A request is rejected when
 * the number of timestamps still inside the window meets or exceeds `limit`.
 *
 * When {@link CacheConfig.enableBans | enableBans} is `true`, a banned key
 * is short-circuited before the timestamp logic runs — the ban's remaining
 * time is returned as `retryAfterMs`.
 *
 * @param cache - Cache and ban policy configuration.
 * @returns A function `(key: string, limit?: number, windowMs?: number) => RateLimitResult`.
 */
export function slidingWindowRateLimiter(cache: CacheConfig) {
    
  const slidingWindowCache = new MiniCache<RateEntry>(cache.maxEntries, cache.sweepIntervalMs);
  const banHandler = createBanHandler(cache);

  const rateLimiter = (key: string, limit = 50, windowMs = 1000): RateLimitResult => {

    const banRemaining = banHandler.checkBan(key);
    if (banRemaining > 0) {
        return { allowed: false, retryAfterMs: banRemaining, remainingPoints: 0 };
    }

    const now = Date.now();
    const windowStart = now - windowMs;

    const entry = slidingWindowCache.get(key) ?? { timestamps: [] };

    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

    if (entry.timestamps.length >= limit) {
        slidingWindowCache.set(key, entry, windowMs);
        const banDuration = banHandler.recordViolation(key, windowMs);
        const retryAfterMs = banDuration > 0 ? banDuration : (entry.timestamps[0] + windowMs) - now;
        return { allowed: false, retryAfterMs, remainingPoints: 0 };
    }

    entry.timestamps.push(now);
    slidingWindowCache.set(key, entry, windowMs);
    banHandler.resetViolations(key);
    return { allowed: true, retryAfterMs: 0, remainingPoints: limit - entry.timestamps.length };
};
    return rateLimiter;
}




/**
 * Creates a sliding-window counter rate limiter backed by an in-memory cache.
 *
 * This algorithm approximates a true sliding window by splitting time into
 * discrete buckets aligned to `windowMs` boundaries. The estimated request
 * count is `currentBucket + previousBucket * weight`, where `weight`
 * decreases linearly from `1` to `0` as time progresses through the
 * current bucket. A request is rejected when `estimatedCount >= limit`.
 *
 * `remainingPoints` is the floored difference between `limit` and the
 * estimated count after the current request, so it may be approximate.
 *
 * When {@link CacheConfig.enableBans | enableBans} is `true`, a banned key
 * is short-circuited before the bucket logic runs — the ban's remaining
 * time is returned as `retryAfterMs`.
 *
 * @param cache - Cache and ban policy configuration.
 * @returns A function `(key: string, limit?: number, windowMs?: number) => RateLimitResult`.
 */
export function slidingWindowCounterRateLimiter(cache: CacheConfig) {
  const counters = new MiniCache<CounterEntry>(cache.maxEntries, cache.sweepIntervalMs);
  const banHandler = createBanHandler(cache);

  const rateLimiter = (key: string, limit = 50, windowMs = 1000): RateLimitResult => {

        const banRemaining = banHandler.checkBan(key);
        if (banRemaining > 0) {
            return { allowed: false, retryAfterMs: banRemaining, remainingPoints: 0 };
        }

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
            const banDuration = banHandler.recordViolation(key, windowMs);
            const retryAfterMs = banDuration > 0 ? banDuration : windowMs - elapsed;
            return { allowed: false, retryAfterMs, remainingPoints: 0 };
        }

        entry.currentBucket += 1;
        counters.set(key, entry, windowMs);
        banHandler.resetViolations(key);
        return { allowed: true, retryAfterMs: 0, remainingPoints: Math.max(0, Math.floor(limit - estimatedCount - 1)) };
  };
  return rateLimiter;
}