import { test, describe } from 'node:test';
import assert from 'node:assert';
import { findStringsInObject } from '../generic/findObjectValues.js';

describe('findStringsInObject', () => {
    test('finds string matching key and value criteria', () => {
        const input = {
            user: {
                email: 'test@example.com',
                name: 'Test'
            }
        };
        const result = findStringsInObject(input, new Set(), {
            keyToSearch: 'email',
            value: /@/
        });
        assert.strictEqual(result, 'test@example.com');
    });

    test('finds string matching only value criteria', () => {
        const input = {
            data: 'test@example.com'
        };
        const result = findStringsInObject(input, new Set(), {
            keyToSearch: 'email',
            value: /@/
        });
        assert.strictEqual(result, 'test@example.com');
    });

    test('recursively searches nested objects', () => {
        const input = {
            a: {
                b: {
                    c: 'match'
                }
            }
        };
        const result = findStringsInObject(input, new Set(), {
            keyToSearch: 'c',
            value: /match/
        });
        assert.strictEqual(result, 'match');
        });


    test('stops recursion at max depth', () => {
        const deepObject = { a: { b: { c: { d: { e: 'found' } } } } };

        assert.ok(findStringsInObject(
            deepObject, 
            new Set(), 
            { keyToSearch: 'e', value: /found/ }, 
            0, 
            5
        ));
        
        assert.strictEqual(findStringsInObject(
            deepObject, 
            new Set(), 
            { keyToSearch: 'e', value: /found/ }, 
            0, 
            3
        ), null);
    });

    test('returns null if no match found', () => {
        const input = { a: 'test' };
        const result = findStringsInObject(input, new Set(), {
            keyToSearch: 'b',
            value: /match/
        });
        assert.strictEqual(result, null);
    });

    test('handles circular references', () => {
        const input: any = { a: 'test' };
        input.self = input;
        
        const result = findStringsInObject(input, new Set(), {
            keyToSearch: 'b',
            value: /nomatch/
        });
        assert.strictEqual(result, null);
    })
});
