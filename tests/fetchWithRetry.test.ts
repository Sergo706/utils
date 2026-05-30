import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { fetchWithRetry } from '../generic/fetchWithRetry.js';

describe('fetchWithRetry', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalSetTimeout: typeof globalThis.setTimeout;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalSetTimeout = globalThis.setTimeout;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    mock.restoreAll();
  });

  it('should return response immediately if successful', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return { ok: true, status: 200 } as Response;
    };

    const res = await fetchWithRetry('http://example.com');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(callCount, 1);
  });

  it('should retry on !res.ok and return the response when out of retries', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return { ok: false, status: 500 } as Response;
    };

    globalThis.setTimeout = ((cb: any) => cb()) as any;

    const retries = 3;
    const res = await fetchWithRetry('http://example.com', retries);
    
    assert.strictEqual(res.ok, false);
    assert.strictEqual(callCount, retries + 1); // 1 initial + 3 retries
  });

  it('should retry on specific status code (number)', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount <= 2) {
        return { ok: false, status: 429 } as Response;
      }
      return { ok: true, status: 200 } as Response;
    };

    globalThis.setTimeout = ((cb: any) => cb()) as any;

    const res = await fetchWithRetry('http://example.com', 5, 10, undefined, 429);
    
    assert.strictEqual(res.ok, true);
    assert.strictEqual(callCount, 3);
  });

  it('should not retry if status code does not match specified statusCodeToRetry', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return { ok: false, status: 500 } as Response;
    };

    globalThis.setTimeout = ((cb: any) => cb()) as any;

    const res = await fetchWithRetry('http://example.com', 5, 10, undefined, 429);
    
    assert.strictEqual(res.ok, false);
    assert.strictEqual(callCount, 1);
  });

  it('should retry if status matches one of the array elements', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) return { ok: false, status: 500 } as Response;
      if (callCount === 2) return { ok: false, status: 503 } as Response;
      return { ok: true, status: 200 } as Response;
    };

    globalThis.setTimeout = ((cb: any) => cb()) as any;

    const res = await fetchWithRetry('http://example.com', 5, 10, undefined, [500, 503]);
    
    assert.strictEqual(res.ok, true);
    assert.strictEqual(callCount, 3);
  });

  it('should retry on network error and eventually throw if out of retries', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      throw new Error('Network failure');
    };

    globalThis.setTimeout = ((cb: any) => cb()) as any;

    try {
      await fetchWithRetry('http://example.com', 2);
      assert.fail('Should have thrown an error');
    } catch (err: any) {
      assert.strictEqual(err.message, 'Network failure');
      assert.strictEqual(callCount, 3); // 1 initial + 2 retries
    }
  });

  it('should correctly calculate exponential backoff with jitter', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return { ok: false, status: 500 } as Response;
    };

    const delays: number[] = [];
    globalThis.setTimeout = ((cb: any, delay: number) => {
      delays.push(delay);
      cb();
    }) as any;

    // base delay 100
    await fetchWithRetry('http://example.com', 3, 100);
    
    assert.strictEqual(delays.length, 3);
    
    // first retry delay, base 100 + jitter (0-50). range: 100 - 150
    assert.ok(delays[0] >= 100 && delays[0] <= 150, `Delay 0 was ${delays[0]}`);
    
    // second retry delay, base 200 + jitter (0-100). range: 200 - 300
    assert.ok(delays[1] >= 200 && delays[1] <= 300, `Delay 1 was ${delays[1]}`);
    
    // third retry delay, base 400 + jitter (0-200). range: 400 - 600
    assert.ok(delays[2] >= 400 && delays[2] <= 600, `Delay 2 was ${delays[2]}`);
  });
});
