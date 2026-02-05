import { test, describe } from 'node:test';
import assert from 'node:assert';
import { capitalize, capitalizeSentence } from '../generic/capitalize.js';

describe('capitalize', () => {
    test('capitalizes the first letter of a string', () => {
        assert.strictEqual(capitalize('hello'), 'Hello');
        assert.strictEqual(capitalize('world'), 'World');
    });

    test('handles empty strings', () => {
        assert.strictEqual(capitalize(''), '');
    });

    test('handles already capitalized strings', () => {
        assert.strictEqual(capitalize('Hello'), 'Hello');
    });

    test('handles single character strings', () => {
        assert.strictEqual(capitalize('a'), 'A');
    });
});

describe('capitalizeSentence', () => {
    test('capitalizes the first letter of every word', () => {
        assert.strictEqual(capitalizeSentence('hello world'), 'Hello World');
    });

    test('handles single word sentences', () => {
        assert.strictEqual(capitalizeSentence('hello'), 'Hello');
    });
    test('handles long sentences', () => {
        assert.strictEqual(capitalizeSentence('culpa nostrud culpa duis ex sunt.'), 'Culpa Nostrud Culpa Duis Ex Sunt.');
    });

    test('handles empty strings', () => {
        assert.strictEqual(capitalizeSentence(''), '');
    });
});
