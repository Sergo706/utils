import { test, describe } from 'node:test';
import assert from 'node:assert';
import { range } from '../generic/range.js';

describe('range', () => {
    test('generates range exclusive start', () => {
        const r = [...range(0, 3)];
        assert.deepStrictEqual(r, [1, 2, 3]);
    });

    test('generates range inclusive start', () => {
        const r = [...range(0, 2, 1, true)];
        assert.deepStrictEqual(r, [0, 1, 2]);
    });

    test('uses step', () => {
        const r = [...range(0, 10, 2, true)];
        assert.deepStrictEqual(r, [0, 2, 4, 6, 8, 10]);
    });

    test('handles empty range', () => {
        const r = [...range(5, 0)];
        assert.deepStrictEqual(r, []);
    });

    test('throws error when step is 0 or negative', () => {
        assert.throws(() => [...range(0, 10, 0)], /step must be greater than 0/);
        assert.throws(() => [...range(0, 10, -1)], /step must be greater than 0/);
    });
});
