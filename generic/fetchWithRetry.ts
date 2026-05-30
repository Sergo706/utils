/**
 * Fetches a URL and automatically retries the request if it fails or returns a specific error status.
 * Uses exponential backoff with jitter to prevent overwhelming the server.
 *
 * @param url - The URL to fetch.
 * @param retries - The maximum number of retry attempts (default: 5).
 * @param delay - The base delay in milliseconds before the first retry. It doubles on each subsequent retry (default: 1000).
 * @param init - Optional custom settings to apply to the fetch request.
 * @param statusCodeToRetry - A specific HTTP status code (429) or array of codes ([429, 500]) that should trigger a retry. If not provided, any non-OK response (`!res.ok`) will trigger a retry.
 * @returns A Promise resolving to the Response object from the fetch.
 * @throws The last error encountered if all retries are exhausted.
 */
export async function fetchWithRetry(
  url: string, 
  retries = 5, 
  delay = 1000, 
  init?: RequestInit, 
  statusCodeToRetry?: number | number[]
): Promise<Response> {
  try {
    const res = await fetch(url, init);
    
    let shouldRetry = false;
    if (statusCodeToRetry !== undefined) {
      if (Array.isArray(statusCodeToRetry)) {
        shouldRetry = statusCodeToRetry.includes(res.status);
      } else {
        shouldRetry = res.status === statusCodeToRetry;
      }
    } else {
      shouldRetry = !res.ok;
    }

    if (shouldRetry && retries > 0) {
      const jitter = Math.random() * (delay * 0.5);
      const totalWait = delay + jitter;

      await new Promise(resolve => setTimeout(resolve, totalWait));
      return await fetchWithRetry(url, retries - 1, delay * 2, init, statusCodeToRetry);
    }
    
    return res;
  } catch (err) {
    if (retries > 0) {
      return fetchWithRetry(url, retries - 1, delay * 2, init, statusCodeToRetry);
    }
    throw err;
  }
}