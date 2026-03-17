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
});
