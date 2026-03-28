import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BatchQueue } from '../generic/batchQueue.js';

interface Job { value: number }

const silentLogger = { error: () => {}, info: () => {} };

function makeQueue(
    processor: (p: Job) => Promise<void>,
    overrides: { maxBufferSize?: number; flushIntervalMs?: number; maxRetries?: number } = {}
) {
    return new BatchQueue<Job>(processor, {
        maxBufferSize: 10,
        flushIntervalMs: 50,
        maxRetries: 2,
        logger: silentLogger,
        ...overrides,
    });
}

describe('BatchQueue', () => {
    describe('add / deferred flush', () => {
        test('does not call processor before timer fires', async () => {
            const calls: number[] = [];
            const queue = makeQueue(async ({ value }) => { calls.push(value); }, { flushIntervalMs: 100 });

            await queue.add('a', { value: 1 });
            assert.equal(calls.length, 0);

            await new Promise(r => setTimeout(r, 150));
            assert.equal(calls.length, 1);
            assert.deepEqual(calls, [1]);
        });

        test('deduplicates jobs with the same id', async () => {
            const calls: number[] = [];
            const queue = makeQueue(async ({ value }) => { calls.push(value); });

            await queue.add('x', { value: 1 });
            await queue.add('x', { value: 2 });
            await queue.flush();

            assert.deepEqual(calls, [2]);
        });

        test('enqueues multiple distinct jobs', async () => {
            const calls: number[] = [];
            const queue = makeQueue(async ({ value }) => { calls.push(value); });

            await queue.add('a', { value: 10 });
            await queue.add('b', { value: 20 });
            await queue.flush();

            calls.sort((a, b) => a - b);
            assert.deepEqual(calls, [10, 20]);
        });
    });

    describe('immediate priority', () => {
        test('flushes synchronously when priority is immediate', async () => {
            const calls: number[] = [];
            const queue = makeQueue(async ({ value }) => { calls.push(value); }, { flushIntervalMs: 10_000 });

            await queue.add('a', { value: 42 }, 'immediate');
            assert.equal(calls.length, 1);
            assert.equal(calls[0], 42);
        });
    });

    describe('buffer-size auto-flush', () => {
        test('flushes automatically when maxBufferSize is reached', async () => {
            const calls: number[] = [];
            const queue = makeQueue(async ({ value }) => { calls.push(value); }, {
                maxBufferSize: 3,
                flushIntervalMs: 10_000,
            });

            await queue.add('a', { value: 1 });
            await queue.add('b', { value: 2 });
            assert.equal(calls.length, 0);

            await queue.add('c', { value: 3 });
            assert.equal(calls.length, 3);
        });
    });

    describe('retry on failure', () => {
        test('retries up to maxRetries times then discards', async () => {
            let attempts = 0;
            const queue = makeQueue(
                async () => { attempts++; throw new Error('fail'); },
                { maxRetries: 2, flushIntervalMs: 10_000 }
            );

            await queue.add('a', { value: 1 });
            await queue.flush();

            assert.equal(attempts, 3);
        });

        test('stops retrying once processor succeeds', async () => {
            let attempts = 0;
            const queue = makeQueue(
                async () => {
                    attempts++;
                    if (attempts < 2) throw new Error('fail');
                },
                { maxRetries: 3, flushIntervalMs: 10_000 }
            );

            await queue.add('a', { value: 1 });
            await queue.flush();

            assert.equal(attempts, 2);
        });
    });

    describe('flush', () => {
        test('no ops when queue is empty', async () => {
            const calls: number[] = [];
            const queue = makeQueue(async ({ value }) => { calls.push(value); });

            await queue.flush();
            assert.equal(calls.length, 0);
        });

        test('multiple flush() calls on an empty queue all resolve without error', async () => {
            const queue = makeQueue(async () => {});

            await queue.flush();
            await queue.flush();
            await queue.flush();
        });

        test('concurrent flush calls are coalesced', async () => {
            let running = 0;
            let maxConcurrent = 0;

            const queue = makeQueue(async () => {
                running++;
                maxConcurrent = Math.max(maxConcurrent, running);
                await new Promise(r => setTimeout(r, 10));
                running--;
            });

            await queue.add('a', { value: 1 });
            const [, ] = await Promise.all([queue.flush(), queue.flush()]);

            assert.equal(maxConcurrent, 1);
        });
    });

    describe('concurrent flush guard', () => {
        test('each job is processed exactly once when two flush calls race', async () => {
            const calls: number[] = [];

            const queue = makeQueue(async ({ value }) => {
                await new Promise(r => setTimeout(r, 5));
                calls.push(value);
            }, { flushIntervalMs: 10_000 });

            await queue.add('a', { value: 7 });
            await Promise.all([queue.flush(), queue.flush()]);

            assert.equal(calls.length, 1);
            assert.equal(calls[0], 7);
        });

        test('last-write-wins value is the one processed, not an earlier overwritten value', async () => {
            const calls: number[] = [];

            const queue = makeQueue(async ({ value }) => {
                calls.push(value);
            }, { flushIntervalMs: 10_000 });

            await queue.add('x', { value: 1 });
            await queue.add('x', { value: 2 });
            await queue.add('x', { value: 3 });
            await Promise.all([queue.flush(), queue.flush()]);

            assert.equal(calls.length, 1);
            assert.equal(calls[0], 3);
        });
    });

    describe('race conditions', () => {
        test('jobs added during an active flush are processed before flush() returns', async () => {
            const calls: number[] = [];
            let resolveBlock!: () => void;

            const queue = makeQueue(async ({ value }) => {
                if (value === 1) {
                    await new Promise<void>(r => { resolveBlock = r; });
                }
                calls.push(value);
            }, { flushIntervalMs: 10_000 });

            await queue.add('a', { value: 1 });
            const flushPromise = queue.flush();

            await Promise.resolve();

            void queue.add('b', { value: 2 });

            resolveBlock();
            await flushPromise;

            assert.deepEqual(calls.sort((a, b) => a - b), [1, 2]);
        });

        test('flushPromise guard stays set during retries, preventing concurrent duplicate execution', async () => {
            let concurrent = 0;
            let maxConcurrent = 0;
            let callCount = 0;

            const queue = makeQueue(async () => {
                concurrent++;
                maxConcurrent = Math.max(maxConcurrent, concurrent);
                await new Promise(r => setTimeout(r, 10));
                concurrent--;
                callCount++;
                if (callCount === 1) throw new Error('first attempt fails');
            }, { maxRetries: 1, flushIntervalMs: 10_000 });

            await queue.add('a', { value: 1 });

            await Promise.all([queue.flush(), queue.flush()]);

            assert.equal(maxConcurrent, 1);
        });
    });

    describe('shutdown', () => {
        test('drains remaining jobs before returning', async () => {
            const calls: number[] = [];
            const queue = makeQueue(async ({ value }) => { calls.push(value); }, { flushIntervalMs: 10_000 });

            await queue.add('a', { value: 99 });
            assert.equal(calls.length, 0);

            await queue.shutdown();
            assert.equal(calls.length, 1);
            assert.equal(calls[0], 99);
        });
    });

    describe('high-volume stress', () => {
        test('overwrite race, 50 unique ids each added 20 times concurrently are each processed exactly once', async () => {
            const calls: number[] = [];
            const queue = makeQueue(async ({ value }) => {
                calls.push(value);
            }, { maxBufferSize: 200, flushIntervalMs: 10_000 });

            await Promise.all(
                Array.from({ length: 50 }, (_, i) =>
                    Promise.all(
                        Array.from({ length: 20 }, () =>
                            queue.add(`session-${i}`, { value: i })
                        )
                    )
                )
            );
            await queue.flush();

            assert.equal(calls.length, 50);
            assert.equal(new Set(calls).size, 50);
        });


        test('300 distinct jobs in batches of 50 are all processed exactly once', async () => {
            const calls: number[] = [];
            const queue = makeQueue(async ({ value }) => {
                calls.push(value);
            }, { maxBufferSize: 100, flushIntervalMs: 10_000 });

            const BATCH = 50;
            const TOTAL = 300;
            for (let start = 0; start < TOTAL; start += BATCH) {
                const end = Math.min(start + BATCH, TOTAL);
                await Promise.all(
                    Array.from({ length: end - start }, (_, i) =>
                        queue.add(`job-${start + i}`, { value: start + i })
                    )
                );
            }
            await queue.flush();

            assert.equal(calls.length, 300);
            assert.equal(new Set(calls).size, 300);
        });

        test('explicit flush after concurrent burst drains all jobs with no duplicates', async () => {
            const calls: number[] = [];
            const queue = makeQueue(async ({ value }) => {
                calls.push(value);
            }, { maxBufferSize: 200, flushIntervalMs: 10_000 });

            await Promise.all(
                Array.from({ length: 100 }, (_, i) =>
                    queue.add(`job-${i}`, { value: i })
                )
            );

            await new Promise(r => setImmediate(r));
            await queue.flush();

            assert.equal(calls.length, 100);
            assert.equal(new Set(calls).size, 100);
        });
    });
});
