import { test, describe } from 'node:test';
import assert from 'node:assert';
import { fisherYatesShuffle } from '../generic/fisherYatesShuffle.js';

describe('fisherYatesShuffle', () => {
    test('preserves array length and elements', () => {
        const input = [1, 2, 3, 4, 5];
        const output = fisherYatesShuffle(input);
        
        assert.strictEqual(output.length, input.length);
        assert.deepStrictEqual(output.sort(), input.sort());
    });

    test('returns a new array (immutable)', () => {
        const input = [1, 2, 3];
        const output = fisherYatesShuffle(input);
        
        assert.notStrictEqual(output, input);
    });

    test('shuffles the array (probabilistic)', () => {
  
        const input = Array.from({ length: 100 }, (_, i) => i);
        const output = fisherYatesShuffle(input);
        
        assert.notDeepStrictEqual(output, input);
    });
});
