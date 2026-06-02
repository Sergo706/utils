import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
    fixedWindowRateLimiter,
    slidingWindowCounterRateLimiter,
    slidingWindowRateLimiter,
    type CacheConfig,
} from '../generic/rateLimiters.js';
import { installMockClock } from './utils/rateLimiterTestUtils.js';

type RateLimiter = (key: string, limit?: number, windowMs?: number) => boolean;
type RateLimiterFactory = (cache: CacheConfig) => RateLimiter;

const limiterFactories = [
    { name: 'fixedWindowRateLimiter', create: fixedWindowRateLimiter },
    { name: 'slidingWindowRateLimiter', create: slidingWindowRateLimiter },
    { name: 'slidingWindowCounterRateLimiter', create: slidingWindowCounterRateLimiter },
] satisfies Array<{ name: string; create: RateLimiterFactory }>;

for (const { name, create } of limiterFactories) {
    describe(name, () => {
        test('keeps different keys isolated', { concurrency: false }, (t) => {
            const clock = installMockClock(0);
            t.after(() => clock.restore());

            const limiter = create({ maxEntries: 10, sweepIntervalMs: 5 });

            assert.strictEqual(limiter('one', 2, 100), true);
            assert.strictEqual(limiter('one', 2, 100), true);
            assert.strictEqual(limiter('one', 2, 100), false);

            assert.strictEqual(limiter('two', 2, 100), true);
            assert.strictEqual(limiter('two', 2, 100), true);
            assert.strictEqual(limiter('two', 2, 100), false);
        });

        test('respects maxEntries eviction and treats evicted keys as fresh', { concurrency: false }, (t) => {
            const clock = installMockClock(0);
            t.after(() => clock.restore());

            const limiter = create({ maxEntries: 2, sweepIntervalMs: 5 });

            assert.strictEqual(limiter('oldest', 1, 100), true);
            clock.advance(1);
            assert.strictEqual(limiter('middle', 1, 100), true);
            clock.advance(1);
            assert.strictEqual(limiter('newest', 1, 100), true);
            clock.advance(1);

            assert.strictEqual(limiter('oldest', 1, 100), true);
        });

        test('resets after the window fully expires', { concurrency: false }, (t) => {
            const clock = installMockClock(0);
            t.after(() => clock.restore());

            const limiter = create({ maxEntries: 5, sweepIntervalMs: 5 });

            assert.strictEqual(limiter('client', 2, 100), true);
            assert.strictEqual(limiter('client', 2, 100), true);
            assert.strictEqual(limiter('client', 2, 100), false);

            clock.advance(250);

            assert.strictEqual(limiter('client', 2, 100), true);
            assert.strictEqual(limiter('client', 2, 100), true);
            assert.strictEqual(limiter('client', 2, 100), false);
        });

        test('blocks bursts after the configured limit', { concurrency: false }, (t) => {
            const clock = installMockClock(0);
            t.after(() => clock.restore());

            const limiter = create({ maxEntries: 10, sweepIntervalMs: 5 });
            const results = Array.from({ length: 8 }, () => limiter('burst', 5, 1_000));

            assert.deepStrictEqual(results, [true, true, true, true, true, false, false, false]);
        });
    });
}

describe('fixedWindowRateLimiter specific behavior', () => {
    test('anchors the window to the first accepted request instead of calendar buckets', { concurrency: false }, (t) => {
        const clock = installMockClock(25);
        t.after(() => clock.restore());

        const limiter = fixedWindowRateLimiter({});

        assert.strictEqual(limiter('client', 1, 100), true);

        clock.set(124);
        assert.strictEqual(limiter('client', 1, 100), false);

        clock.set(125);
        assert.strictEqual(limiter('client', 1, 100), true);
    });

    test('reopens exactly at the fixed-window boundary', { concurrency: false }, (t) => {
        const clock = installMockClock(0);
        t.after(() => clock.restore());

        const limiter = fixedWindowRateLimiter({ maxEntries: 3, sweepIntervalMs: 10 });

        assert.strictEqual(limiter('client', 2, 100), true);

        clock.set(50);
        assert.strictEqual(limiter('client', 2, 100), true);

        clock.set(99);
        assert.strictEqual(limiter('client', 2, 100), false);

        clock.set(100);
        assert.strictEqual(limiter('client', 2, 100), true);
    });
});

describe('slidingWindowRateLimiter specific behavior', () => {
    test('expires only timestamps that move outside the rolling window', { concurrency: false }, (t) => {
        const clock = installMockClock(0);
        t.after(() => clock.restore());

        const limiter = slidingWindowRateLimiter({ maxEntries: 5, sweepIntervalMs: 5 });

        assert.strictEqual(limiter('client', 2, 100), true);

        clock.set(60);
        assert.strictEqual(limiter('client', 2, 100), true);

        clock.set(99);
        assert.strictEqual(limiter('client', 2, 100), false);

        clock.set(100);
        assert.strictEqual(limiter('client', 2, 100), true);

        clock.set(159);
        assert.strictEqual(limiter('client', 2, 100), false);

        clock.set(160);
        assert.strictEqual(limiter('client', 2, 100), true);
    });

    test('frees only one slot when just one request ages out of a burst', { concurrency: false }, (t) => {
        const clock = installMockClock(0);
        t.after(() => clock.restore());

        const limiter = slidingWindowRateLimiter({});

        assert.strictEqual(limiter('client', 3, 100), true);

        clock.set(20);
        assert.strictEqual(limiter('client', 3, 100), true);

        clock.set(40);
        assert.strictEqual(limiter('client', 3, 100), true);

        clock.set(100);
        assert.strictEqual(limiter('client', 3, 100), true);
        assert.strictEqual(limiter('client', 3, 100), false);
    });
});

describe('slidingWindowCounterRateLimiter specific behavior', () => {
    test('carries weighted pressure into the next bucket', { concurrency: false }, (t) => {
        const clock = installMockClock(0);
        t.after(() => clock.restore());

        const limiter = slidingWindowCounterRateLimiter({ maxEntries: 5, sweepIntervalMs: 5 });

        assert.strictEqual(limiter('client', 3, 100), true);
        assert.strictEqual(limiter('client', 3, 100), true);
        assert.strictEqual(limiter('client', 3, 100), true);
        assert.strictEqual(limiter('client', 3, 100), false);

        clock.set(100);
        assert.strictEqual(limiter('client', 3, 100), false);

        clock.set(101);
        assert.strictEqual(limiter('client', 3, 100), true);
        assert.strictEqual(limiter('client', 3, 100), false);
    });

    test('drops bucket history after more than one bucket passes', { concurrency: false }, (t) => {
        const clock = installMockClock(0);
        t.after(() => clock.restore());

        const limiter = slidingWindowCounterRateLimiter({});

        assert.strictEqual(limiter('client', 2, 100), true);
        assert.strictEqual(limiter('client', 2, 100), true);
        assert.strictEqual(limiter('client', 2, 100), false);

        clock.set(250);

        assert.strictEqual(limiter('client', 2, 100), true);
        assert.strictEqual(limiter('client', 2, 100), true);
        assert.strictEqual(limiter('client', 2, 100), false);
    });
});