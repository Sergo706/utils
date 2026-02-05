import { test, describe } from 'node:test';
import assert from 'node:assert';
import ensureArray from '../generic/ensureArray.js';

describe('ensureArray', () => {
    test('wraps single string in array', () => {
        assert.deepStrictEqual(ensureArray('hello'), ['hello']);
    });

    test('returns array as is if input is array', () => {
        assert.deepStrictEqual(ensureArray(['a', 'b']), ['a', 'b']);
    });

    test('returns empty array for null/undefined', () => {
        assert.deepStrictEqual(ensureArray(null), []);
        assert.deepStrictEqual(ensureArray(undefined), []);
        assert.deepStrictEqual(ensureArray(''), []);
    });

    test('filters null values from array input', () => {
        assert.deepStrictEqual(ensureArray(['a', null, 'b']), ['a', 'b']);
    });
});
