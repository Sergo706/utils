import { test, describe } from 'node:test';
import assert from 'node:assert';
import { cleanObject } from '../generic/cleanObject.js';

describe('cleanObject', () => {
    test('removes undefined values', () => {
        const input = { a: 1, b: undefined, c: 'test' };
        const output = cleanObject(input);
        assert.deepStrictEqual(output, { a: 1, c: 'test' });
    });

    test('removes empty objects recursively', () => {
        const input = { a: 1, b: { c: undefined } };
        const output = cleanObject(input);
        assert.deepStrictEqual(output, { a: 1 });
    });

    test('keeps null values', () => {
        const input = { a: 1, b: null };
        const output = cleanObject(input);
        assert.deepStrictEqual(output, { a: 1, b: null });
    });

    test('keeps empty arrays', () => {
        const input = { a: 1, b: [] };
        const output = cleanObject(input);
        assert.deepStrictEqual(output, { a: 1, b: [] });
    });

    test('keeps nested valid objects', () => {
        const input = { a: 1, b: { c: 2 } };
        const output = cleanObject(input);
        assert.deepStrictEqual(output, { a: 1, b: { c: 2 } });
    });

    test('handles complex nested structure', () => {
        const input = {
            a: 1,
            b: undefined,
            c: {
                d: 2,
                e: undefined,
                f: {
                    g: undefined
                }
            },
            h: [1, 2],
            i: null
        };
        const output = cleanObject(input as any);
        assert.deepStrictEqual(output, {
            a: 1,
            c: { d: 2 },
            h: [1, 2],
            i: null
        });
    });
    test('handles handles circular reference', () => {
        const input: any = { a: 1 };
        input.self = input;
        
        const output = cleanObject(input);
        assert.deepStrictEqual(output, { a: 1 });
    });
});
