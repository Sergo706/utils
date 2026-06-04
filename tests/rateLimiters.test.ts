import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
    fixedWindowRateLimiter,
    slidingWindowCounterRateLimiter,
    slidingWindowRateLimiter,
    type CacheConfig,
    type RateLimitResult,
} from '../generic/rateLimiters.js';
import { installMockClock } from './utils/rateLimiterTestUtils.js';

type RateLimiter = (key: string, limit?: number, windowMs?: number) => RateLimitResult;
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

            assert.strictEqual(limiter('one', 2, 100).allowed, true);
            assert.strictEqual(limiter('one', 2, 100).allowed, true);
            assert.strictEqual(limiter('one', 2, 100).allowed, false);

            assert.strictEqual(limiter('two', 2, 100).allowed, true);
            assert.strictEqual(limiter('two', 2, 100).allowed, true);
            assert.strictEqual(limiter('two', 2, 100).allowed, false);
        });

        test('respects maxEntries eviction and treats evicted keys as fresh', { concurrency: false }, (t) => {
            const clock = installMockClock(0);
            t.after(() => clock.restore());

            const limiter = create({ maxEntries: 2, sweepIntervalMs: 5 });

            assert.strictEqual(limiter('oldest', 1, 100).allowed, true);
            clock.advance(1);
            assert.strictEqual(limiter('middle', 1, 100).allowed, true);
            clock.advance(1);
            assert.strictEqual(limiter('newest', 1, 100).allowed, true);
            clock.advance(1);

            assert.strictEqual(limiter('oldest', 1, 100).allowed, true);
        });

        test('resets after the window fully expires', { concurrency: false }, (t) => {
            const clock = installMockClock(0);
            t.after(() => clock.restore());

            const limiter = create({ maxEntries: 5, sweepIntervalMs: 5 });

            assert.strictEqual(limiter('client', 2, 100).allowed, true);
            assert.strictEqual(limiter('client', 2, 100).allowed, true);
            assert.strictEqual(limiter('client', 2, 100).allowed, false);

            clock.advance(250);

            assert.strictEqual(limiter('client', 2, 100).allowed, true);
            assert.strictEqual(limiter('client', 2, 100).allowed, true);
            assert.strictEqual(limiter('client', 2, 100).allowed, false);
        });

        test('blocks bursts after the configured limit', { concurrency: false }, (t) => {
            const clock = installMockClock(0);
            t.after(() => clock.restore());

            const limiter = create({ maxEntries: 10, sweepIntervalMs: 5 });
            const results = Array.from({ length: 8 }, () => limiter('burst', 5, 1_000).allowed);

            assert.deepStrictEqual(results, [true, true, true, true, true, false, false, false]);
        });

        test('returns remainingPoints tracking', { concurrency: false }, (t) => {
            const clock = installMockClock(0);
            t.after(() => clock.restore());

            const limiter = create({ maxEntries: 10, sweepIntervalMs: 5 });

            const r1 = limiter('points', 3, 100);
            assert.strictEqual(r1.allowed, true);
            assert.strictEqual(r1.remainingPoints, 2);

            const r2 = limiter('points', 3, 100);
            assert.strictEqual(r2.allowed, true);
            assert.strictEqual(r2.remainingPoints, 1);

            const r3 = limiter('points', 3, 100);
            assert.strictEqual(r3.allowed, true);
            assert.strictEqual(r3.remainingPoints, 0);

            const r4 = limiter('points', 3, 100);
            assert.strictEqual(r4.allowed, false);
            assert.strictEqual(r4.remainingPoints, 0);
            assert.ok(r4.retryAfterMs > 0, 'retryAfterMs should be > 0 when rejected');
        });

        test('returns retryAfterMs: 0 when allowed', { concurrency: false }, (t) => {
            const clock = installMockClock(0);
            t.after(() => clock.restore());

            const limiter = create({ maxEntries: 10, sweepIntervalMs: 5 });

            const result = limiter('ok', 5, 100);
            assert.strictEqual(result.allowed, true);
            assert.strictEqual(result.retryAfterMs, 0);
        });

        test('bans after reaching allowedAttemptsBeforeBan consecutive violations', { concurrency: false }, (t) => {
            const clock = installMockClock(0);
            t.after(() => clock.restore());

            const limiter = create({
                maxEntries: 10,
                sweepIntervalMs: 5,
                enableBans: true,
                allowedAttemptsBeforeBan: 3,
                banMultiplier: 2,
            });


            assert.strictEqual(limiter('abuser', 1, 100).allowed, true);


            assert.strictEqual(limiter('abuser', 1, 100).allowed, false);
            assert.strictEqual(limiter('abuser', 1, 100).allowed, false); 
            const banTrigger = limiter('abuser', 1, 100);
            assert.strictEqual(banTrigger.allowed, false);
    
            assert.strictEqual(banTrigger.retryAfterMs, 600);


            const banned = limiter('abuser', 1, 100);
            assert.strictEqual(banned.allowed, false);
            assert.ok(banned.retryAfterMs > 0, 'should still report remaining ban time');
            assert.strictEqual(banned.remainingPoints, 0);
        });

        test('escalates ban duration for repeat offenders and respects cooldown', { concurrency: false }, (t) => {
            const clock = installMockClock(0);
            t.after(() => clock.restore());

            const limiter = create({
                maxEntries: 10,
                sweepIntervalMs: 5,
                enableBans: true,
                allowedAttemptsBeforeBan: 3,
                banMultiplier: 2,
                penaltyCooldownMultiplier: 5,
            });

            limiter('repeat', 1, 100); 
            limiter('repeat', 1, 100); 
            limiter('repeat', 1, 100);
            const ban1 = limiter('repeat', 1, 100);
            // base = 300. ban1 = 300 * 2^1 = 600.
            assert.strictEqual(ban1.retryAfterMs, 600);

            // cooldown is 600 * 5 = 3000, so TTL is 3600
            clock.advance(601);

            // 2nd ban - tier 2
            limiter('repeat', 1, 100);
            limiter('repeat', 1, 100); 
            limiter('repeat', 1, 100);

            const ban2 = limiter('repeat', 1, 100);

            // base = 300. ban2 = 300 * 2^2 = 1200.
            assert.strictEqual(ban2.retryAfterMs, 1200);

            // cooldown = 1200 * 5 = 6000. TTL = 7200.
            clock.advance(7201);

            // should reset to tier 1
            limiter('repeat', 1, 100);
            limiter('repeat', 1, 100); 
            limiter('repeat', 1, 100);

            const ban3 = limiter('repeat', 1, 100);
            
            // base = 300. ban3 = 300 * 2^1 = 600.
            assert.strictEqual(ban3.retryAfterMs, 600);
        });

        test('ban expires and key gets a fresh start', { concurrency: false }, (t) => {
            const clock = installMockClock(0);
            t.after(() => clock.restore());

            const limiter = create({
                maxEntries: 10,
                sweepIntervalMs: 5,
                enableBans: true,
                allowedAttemptsBeforeBan: 3,
            });

     
            limiter('temp', 1, 100);
            limiter('temp', 1, 100);
            limiter('temp', 1, 100);
            limiter('temp', 1, 100);

     
            clock.advance(700);

            const result = limiter('temp', 1, 100);
            assert.strictEqual(result.allowed, true);
        });

        test('does not ban when enableBans is false', { concurrency: false }, (t) => {
            const clock = installMockClock(0);
            t.after(() => clock.restore());

            const limiter = create({
                maxEntries: 10,
                sweepIntervalMs: 5,
                enableBans: false,
                allowedAttemptsBeforeBan: 1,
            });

            assert.strictEqual(limiter('normal', 1, 100).allowed, true);
            assert.strictEqual(limiter('normal', 1, 100).allowed, false);


            limiter('normal', 1, 100);
            limiter('normal', 1, 100);

     
            clock.advance(150);
            assert.strictEqual(limiter('normal', 1, 100).allowed, true);
        });
    });
}

describe('fixedWindowRateLimiter specific behavior', () => {
    test('anchors the window to the first accepted request instead of calendar buckets', { concurrency: false }, (t) => {
        const clock = installMockClock(25);
        t.after(() => clock.restore());

        const limiter = fixedWindowRateLimiter({});

        assert.strictEqual(limiter('client', 1, 100).allowed, true);

        clock.set(124);
        assert.strictEqual(limiter('client', 1, 100).allowed, false);

        clock.set(125);
        assert.strictEqual(limiter('client', 1, 100).allowed, true);
    });

    test('reopens exactly at the fixed-window boundary', { concurrency: false }, (t) => {
        const clock = installMockClock(0);
        t.after(() => clock.restore());

        const limiter = fixedWindowRateLimiter({ maxEntries: 3, sweepIntervalMs: 10 });

        assert.strictEqual(limiter('client', 2, 100).allowed, true);

        clock.set(50);
        assert.strictEqual(limiter('client', 2, 100).allowed, true);

        clock.set(99);
        assert.strictEqual(limiter('client', 2, 100).allowed, false);

        clock.set(100);
        assert.strictEqual(limiter('client', 2, 100).allowed, true);
    });
});

describe('slidingWindowRateLimiter specific behavior', () => {
    test('expires only timestamps that move outside the rolling window', { concurrency: false }, (t) => {
        const clock = installMockClock(0);
        t.after(() => clock.restore());

        const limiter = slidingWindowRateLimiter({ maxEntries: 5, sweepIntervalMs: 5 });

        assert.strictEqual(limiter('client', 2, 100).allowed, true);

        clock.set(60);
        assert.strictEqual(limiter('client', 2, 100).allowed, true);

        clock.set(99);
        assert.strictEqual(limiter('client', 2, 100).allowed, false);

        clock.set(100);
        assert.strictEqual(limiter('client', 2, 100).allowed, true);

        clock.set(159);
        assert.strictEqual(limiter('client', 2, 100).allowed, false);

        clock.set(160);
        assert.strictEqual(limiter('client', 2, 100).allowed, true);
    });

    test('frees only one slot when just one request ages out of a burst', { concurrency: false }, (t) => {
        const clock = installMockClock(0);
        t.after(() => clock.restore());

        const limiter = slidingWindowRateLimiter({});

        assert.strictEqual(limiter('client', 3, 100).allowed, true);

        clock.set(20);
        assert.strictEqual(limiter('client', 3, 100).allowed, true);

        clock.set(40);
        assert.strictEqual(limiter('client', 3, 100).allowed, true);

        clock.set(100);
        assert.strictEqual(limiter('client', 3, 100).allowed, true);
        assert.strictEqual(limiter('client', 3, 100).allowed, false);
    });
});

describe('slidingWindowCounterRateLimiter specific behavior', () => {
    test('carries weighted pressure into the next bucket', { concurrency: false }, (t) => {
        const clock = installMockClock(0);
        t.after(() => clock.restore());

        const limiter = slidingWindowCounterRateLimiter({ maxEntries: 5, sweepIntervalMs: 5 });

        assert.strictEqual(limiter('client', 3, 100).allowed, true);
        assert.strictEqual(limiter('client', 3, 100).allowed, true);
        assert.strictEqual(limiter('client', 3, 100).allowed, true);
        assert.strictEqual(limiter('client', 3, 100).allowed, false);

        clock.set(100);
        assert.strictEqual(limiter('client', 3, 100).allowed, false);

        clock.set(101);
        assert.strictEqual(limiter('client', 3, 100).allowed, true);
        assert.strictEqual(limiter('client', 3, 100).allowed, false);
    });

    test('drops bucket history after more than one bucket passes', { concurrency: false }, (t) => {
        const clock = installMockClock(0);
        t.after(() => clock.restore());

        const limiter = slidingWindowCounterRateLimiter({});

        assert.strictEqual(limiter('client', 2, 100).allowed, true);
        assert.strictEqual(limiter('client', 2, 100).allowed, true);
        assert.strictEqual(limiter('client', 2, 100).allowed, false);

        clock.set(250);

        assert.strictEqual(limiter('client', 2, 100).allowed, true);
        assert.strictEqual(limiter('client', 2, 100).allowed, true);
        assert.strictEqual(limiter('client', 2, 100).allowed, false);
    });
});