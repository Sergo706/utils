import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Random } from '../generic/random.js';

describe('Random', () => {
    const random = new Random();

    test('getRandomInt returns number within range', () => {
        const val = random.getRandomInt(10);
        assert.ok(val >= 0 && val < 10);
    });

    test('getRandomInt handles negative max', () => {
        const val = random.getRandomInt(-10);
        assert.ok(val >= -10 && val <= 0); 
    });

    test('getRandomArbitrary returns number within range', () => {
        const val = random.getRandomArbitrary(5, 10);
        assert.ok(val >= 5 && val < 10);
    });

    test('getRandomArbitrary handles inverted range (min > max)', () => {
        const val = random.getRandomArbitrary(10, 5);
        assert.ok(val >= 5 && val <= 10);
    });

    test('getRandomElement returns element from array', () => {
        const arr = ['a', 'b', 'c'];
        const val = random.getRandomElement(arr);
        assert.ok(arr.includes(val as string));
    });

    test('getRandomElement returns undefined for empty array', () => {
        assert.strictEqual(random.getRandomElement([]), undefined);
    });
});
