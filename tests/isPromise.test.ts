import { test, describe } from 'node:test';
import assert from 'node:assert';
import { isAsyncOrPromise } from '../generic/isPromise.js';

describe('isAsyncOrPromise', () => {
    test('returns true for Promise', () => {
        assert.strictEqual(isAsyncOrPromise(Promise.resolve()), true);
    });

    test('returns true for Async Function', () => {
        const asyncFn = async () => {};
        assert.strictEqual(isAsyncOrPromise(asyncFn), true);
    });

    test('returns true for Thenable', () => {
        const thenable = { then: () => {} };
        assert.strictEqual(isAsyncOrPromise(thenable), true);
    });

    test('returns false for normal function', () => {
        const fn = () => {};
        assert.strictEqual(isAsyncOrPromise(fn), false);
    });

    test('returns false for values', () => {
        assert.strictEqual(isAsyncOrPromise(1 as any), false);
        assert.strictEqual(isAsyncOrPromise({} as any), false);
        assert.strictEqual(isAsyncOrPromise(null as any), false);
    });
});
