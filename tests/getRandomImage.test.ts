import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getRandomImage, type ImageResults } from '../generic/getRandomImage.js';

describe('getRandomImage', () => {
    test('returns getter and toUrls functions', () => {
        const { getter, toUrls } = getRandomImage(5);
        assert.strictEqual(typeof getter, 'function');
        assert.strictEqual(typeof toUrls, 'function');
    });

    test('toUrls extracts urls from image results', () => {
        const { toUrls } = getRandomImage(5);
        const results: ImageResults[] = [
            { id: '1', author: 'a', width: 100, height: 100, url: 'u1', download_url: 'd1' },
            { id: '2', author: 'b', width: 100, height: 100, url: 'u2', download_url: 'd2' }
        ];
        
        const urls = toUrls(results);
        assert.deepStrictEqual(urls, ['d1', 'd2']);
    });
    
    test('toUrls handles empty input', () => {
        const { toUrls } = getRandomImage(5);
        assert.deepStrictEqual(toUrls([]), []);
    });

    test('toUrls handles error input', () => {
        const { toUrls } = getRandomImage(5);
        assert.deepStrictEqual(toUrls(new Error('fail')), []);
    });

    test('getter returns images (network or fallback)', async () => {
        const { getter, toUrls } = getRandomImage(3);
        const result = await getter();
        
        assert.ok(Array.isArray(result));
        assert.strictEqual(result.length, 3);
        
        const first = result[0];
        assert.ok(first.id);
        assert.ok(first.url);
        assert.ok(first.download_url);
        
        const urls = toUrls(result);
        assert.strictEqual(urls.length, 3);
        assert.ok(typeof urls[0] === 'string');
    });

    test('getter uses fallback on network error', async () => {
        const originalFetch = globalThis.fetch;
        
        globalThis.fetch = async () => {
            throw new Error('Network Error');
        };

        try {
            const { getter } = getRandomImage(2);
            const result = await getter();

            assert.ok(Array.isArray(result));
            assert.strictEqual(result.length, 2);
            
            assert.strictEqual(result[0].author, 'seed');
            assert.strictEqual(result[0].id, '1');
            assert.strictEqual(result[1].author, 'seed');
            assert.strictEqual(result[1].id, '2');
        } finally {

            globalThis.fetch = originalFetch;
        }
    });

});
