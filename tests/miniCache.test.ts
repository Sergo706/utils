import { test, describe } from 'node:test';
import assert from 'node:assert';
import { MiniCache } from '../generic/miniCache.js';

describe('MiniCache', () => {
    test('sets and gets values', () => {
        const cache = new MiniCache();
        cache.set('key', 'value', 1000);
        assert.strictEqual(cache.get('key'), 'value');
    });

    test('returns null for missing keys', () => {
        const cache = new MiniCache();
        assert.strictEqual(cache.get('missing'), null);
    });

    test('expires values', async () => {
        const cache = new MiniCache();
        cache.set('key', 'value', 10);
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.strictEqual(cache.get('key'), null);
    });

    test('evicts oldest when maxEntries reached', () => {
        const cache = new MiniCache(2);
        cache.set('a', 1, 1000);
        cache.set('b', 2, 1000);
        cache.set('c', 3, 1000);

        assert.strictEqual(cache.get('a'), null);
        assert.strictEqual(cache.get('b'), 2);
        assert.strictEqual(cache.get('c'), 3);
    });

    test('updates LRU position on access', () => {
        const cache = new MiniCache(2);
        cache.set('a', 1, 1000);
        cache.set('b', 2, 1000);
        cache.get('a'); // 'a' becomes most recently used
        cache.set('c', 3, 1000); // Should evict 'b'

        assert.strictEqual(cache.get('b'), null);
        assert.strictEqual(cache.get('a'), 1);
    });

    test('clears cache', () => {
        const cache = new MiniCache();
        cache.set('a', 1, 1000);
        cache.clear();
        assert.strictEqual(cache.get('a'), null);
    });
});
