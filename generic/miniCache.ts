interface CacheEntry<T> {
  value: T;
  expiry: number;
};

/**
 * Small in-memory TTL cache supporting LRU-style eviction using insertion order.
 *
 * @typeParam T - Stored value type.
 */
export class MiniCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private maxEntries: number;
  private sweepTimer: NodeJS.Timeout;

  /**
   * Creates a new cache instance.
   *
   * @param maxEntries - Maximum number of entries before evicting the oldest.
   * @param sweepIntervalMs - Interval used to remove expired items.
   */
  constructor(maxEntries = Infinity, sweepIntervalMs = 60_000) {
    this.maxEntries = maxEntries;

    this.sweepTimer = setInterval(() => { this.sweepExpired(); }, sweepIntervalMs);

    if (typeof this.sweepTimer.unref === 'function') {
      this.sweepTimer.unref();
    }
  }

  /**
   * Checks for and removes all expired entries from the store.
   * This is called automatically based on the sweepIntervalMs.
   */
  private sweepExpired() {
    const now = Date.now();
    for (const [key, { expiry }] of this.store) {
      if (expiry <= now) this.store.delete(key);
    }
  }

  /**
   * Retrieves an item from the cache without updating its position in the LRU order
   * or checking/deleting it if expired.
   * 
   * @param key - The lookup key.
   * @returns The stored value or null if not found.
   */
  stale(key: string): T | null {
    const entry = this.store.get(key);
    return entry ? entry.value : null;
  }

  /**
   * Adds or updates a value in the cache with a specified TTL.
   * If the cache exceeds maxEntries, the oldest entry (by insertion/access order) is evicted.
   * 
   * @param key - Unique identifier for the entry.
   * @param value - Value to be cached.
   * @param ttlMs - Time-to-live in milliseconds.
   */
  set(key: string, value: T, ttlMs: number): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    
    const expiry = Date.now() + ttlMs;
    this.store.set(key, { value, expiry });

    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
  }

  /**
   * Retrieves a value from the cache. 
   * - Returns null if the key doesn't exist or is expired (expired items are deleted).
   * - Updates the entry's position to "most recently used" on success.
   * 
   * @param key - The lookup key.
   * @returns The cached value or null if missing/expired.
   */
  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }

    // Refresh position in Map for LRU behavior
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  /**
   * Immediately removes an entry from the cache.
   * 
   * @param key - The key to delete.
   */
  del(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clears all entries from the cache.
   */
  clear(): void {
    this.store.clear();
  }
}