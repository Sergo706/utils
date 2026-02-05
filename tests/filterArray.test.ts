import { test, describe } from 'node:test';
import assert from 'node:assert';
import { filterEmptyValues } from '../generic/filterArray.js';

describe('filterEmptyValues', () => {

    test('removes null/undefined', () => {
        const input = [1, null, undefined, 0, false, ""];
        const output = filterEmptyValues(input);
        assert.deepStrictEqual(output, [1, 0, false, ""]);
    });

    test('performs deep cleanup when enabled', () => {
        const input = [1, null, { val: [2, null] }, [3, undefined]];
        const output = filterEmptyValues(input, true);
        assert.deepStrictEqual(output, [1, { val: [2] }, [3]]);
    });

    test('cleans objects inside array in deep mode', () => {
        const input = [{ a: 1, b: [null, 2] }, { c: undefined }];
        const output = filterEmptyValues(input, true);
        assert.deepStrictEqual(output, [{ a: 1, b: [2] }, { c: undefined }]);
    });

    test('handles empty arrays', () => {
        assert.deepStrictEqual(filterEmptyValues([]), []);
    });

    test('does not modify unrelated values', () => {
        const input = [1, 'test', true, { a: 1 }];
        const output = filterEmptyValues(input);
        assert.deepStrictEqual(output, input);
    });
    
    test('handles complex nested structure with deep cleanup', () => {
        const input = [
            [1, null, 2],
            {
                keep: true,
                list: [10, null, 11],
                nestedObj: {
                    deepList: [undefined, 99]
                },
                nullable: null,
                undef: undefined
            },
            [ { arr: [null] }, null ]
        ];

        const output = filterEmptyValues(input, true);

        assert.deepStrictEqual(output, [
            [1, 2],
            {
                keep: true,
                list: [10, 11],
                nestedObj: {
                    deepList: [99]
                },
                nullable: null,
                undef: undefined
            },
            [ { arr: [] } ]
        ]);
    });
});
