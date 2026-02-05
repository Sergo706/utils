import { test, describe } from 'node:test';
import assert from 'node:assert';
import { isObjectHasValues } from '../generic/isObjectHasValues.js';

describe('isObjectHasValues', () => {
    test('returns true for object with simple values', () => {
        assert.strictEqual(isObjectHasValues({ a: 1 }), true);
        assert.strictEqual(isObjectHasValues({ a: 'test' }), true);
    });

    test('returns false for empty object', () => {
        assert.strictEqual(isObjectHasValues({}), false);
    });

    test('returns false for object with only null/undefined/empty string', () => {
        assert.strictEqual(isObjectHasValues({ a: null, b: undefined, c: '' }), false);
    });

    test('returns true for object with non-empty array', () => {
        assert.strictEqual(isObjectHasValues({ a: [1] }), true);
    });

    test('returns false for object with empty array', () => {
        assert.strictEqual(isObjectHasValues({ a: [] }), false);
    });

    test('recursively checks nested objects', () => {
        assert.strictEqual(isObjectHasValues({ a: { b: 1 } }), true);
        assert.strictEqual(isObjectHasValues({ a: { b: undefined } }), false);
    });
});
