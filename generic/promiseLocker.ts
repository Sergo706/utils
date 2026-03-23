import pino from "pino";
const rotationLocks = new Map<string, Promise<unknown>>();
const recentResults = new Map<string, unknown>();

/**
 * Implements a deduplication and caching mechanism for asynchronous actions.
 * 
 * This utility prevents duplicate concurrent operations with the same token by using a "leader" pattern:
 * 1. **Cache Check**: If a result exists in the short-term cache (`recentResults`), it's returned immediately.
 * 2. **Lock Check**: If an identical action is already in progress, the caller waits for the existing promise.
 * 3. **Leader Execution**: If no lock/cache exists, the caller becomes the "leader", executes the action,
 *    broadcasts the result to waiters, and caches the result for a short period.
 * 
 * Perfect for expensive operations like token rotation where multiple concurrent requests should share one result.
 * 
 * @param token - A unique key used for locking and caching.
 * @param action - The asynchronous action to perform if no lock/cache is found.
 * @param recentResultsTTL - Duration (in ms) to cache the completed result. Defaults to 3000ms.
 * @param log - Pino logger instance for tracking execution flow and cache status.
 * @returns The resolved or cached result of the action.
 * 
 * @example
 * // Only one rotation happens; all callers get the same result.
 * await Promise.all([
 *   safeAction('token123', rotateToken, 3000, logger),
 *   safeAction('token123', rotateToken, 3000, logger)
 * ]);
 */
export async function safeAction<T>(token: string, action: () => Promise<T>, recentResultsTTL = 3000, log: pino.Logger): Promise<T> {
 
    if (recentResults.has(token)) {
        return recentResults.get(token) as T;
    }

    if (rotationLocks.has(token)) {
       
        const result = await rotationLocks.get(token);
        
         if (recentResults.has(token)) {
             return recentResults.get(token) as T;
         }
         return result as T;
    }
    
    log.info('No lock/cache found. Becoming leader.');
    const promise = action();
    rotationLocks.set(token, promise);

    try {
        const result = await promise;
        log.debug({PromiseResults: result});
        recentResults.set(token, result);
        log.info('Action succeeded. Caching result.');
        
        setTimeout(() => {
            recentResults.delete(token);
            log.debug('Cache expired.'); 
        }, recentResultsTTL);

        return result;

   } finally {
        rotationLocks.delete(token);
        log.info('Action finished. Lock released.');
    }

}