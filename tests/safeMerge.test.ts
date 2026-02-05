import { test, describe } from 'node:test';
import assert from 'node:assert';
import { safeObjectMerge } from '../generic/safeMerge.js';

describe('safeObjectMerge', () => {
    test('merges properties', () => {
        const target = { a: 1 };
        const src = { b: 2 };
        safeObjectMerge(target, src, {}, []);
        assert.deepStrictEqual(target, { a: 1, b: 2 });
    });

    test('protects reserved keys (drop mode)', () => {
        const target = { id: 1 };
        const src = { id: 2, b: 3 };
        safeObjectMerge(target, src, { mode: 'drop' }, ['id']);
        assert.deepStrictEqual(target, { id: 1, b: 3 });
    });

    test('throws on reserved key conflict (throw mode)', () => {
        const target = { id: 1 };
        const src = { id: 2 };
        assert.throws(() => {
            safeObjectMerge(target, src, { mode: 'throw' }, ['id']);
        }, /Attempted to overwrite reserved key "id"/);
    });

    test('populates reserved key if missing in target', () => {
        const target: any = {};
        const src = { id: 2 };
        safeObjectMerge(target, src, {}, ['id']);
        assert.deepStrictEqual(target, { id: 2 });
    });

    test('triggers onConflict callback', () => {
        const target = { id: 1 };
        const src = { id: 2 };
        let conflictKey = '';
        let conflictIncoming: unknown;
        let conflictExisting: unknown;

        safeObjectMerge(
            target, 
            src, 
            { 
                mode: 'drop', 
                onConflict: (key, incoming, existing) => {
                    conflictKey = key;
                    conflictIncoming = incoming;
                    conflictExisting = existing;
                } 
            }, 
            ['id']
        );

        assert.strictEqual(conflictKey, 'id');
        assert.strictEqual(conflictIncoming, 2);
        assert.strictEqual(conflictExisting, 1);
        assert.deepStrictEqual(target, { id: 1 }); 
    });

    test('supports extraReserved keys', () => {
        const target = { id: 1, protected: 'original' };
        const src = { id: 2, protected: 'new' };
        
        safeObjectMerge(
            target, 
            src, 
            { mode: 'drop' }, 
            ['id'], 
            new Set(['protected'])
        );
        
        assert.deepStrictEqual(target, { id: 1, protected: 'original' });
    });

    test('modifies target in place', () => {
        const target = { a: 1 };
        const src = { b: 2 };
        const result = safeObjectMerge(target, src, {}, []);
        
        assert.strictEqual(result, target);
        assert.deepStrictEqual(target, { a: 1, b: 2 });
    });
});
