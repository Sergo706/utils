import { test, describe } from 'node:test';
import assert from 'node:assert';
import textTruncation from '../generic/textTruncation.js';

describe('textTruncation', () => {
    test('truncates string longer than max length', () => {
        assert.strictEqual(textTruncation('hello world', 5), 'hello...');
    });

    test('returns original string if shorter than max length', () => {
        assert.strictEqual(textTruncation('hi', 5), 'hi');
    });

    test('returns original string if equal to max length', () => {
        assert.strictEqual(textTruncation('hello', 5), 'hello');
    });

    test('handles zero length', () => {
        assert.strictEqual(textTruncation('hello', 0), '...');
    });

    test('handles negative length', () => {
        assert.strictEqual(textTruncation('hello', -2), 'hel...');
    });
});
