import { test, describe } from 'node:test';
import assert from 'node:assert';
import { debounce } from '../generic/debounce.js';

describe('debounce', () => {
    test('executes after delay', async () => {
        let called = 0;
        const debounced = debounce(() => {
            called++;
        }, 10);

        debounced();
        assert.strictEqual(called, 0);
        
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.strictEqual(called, 1);
    });

    test('resets timer on subsequent calls', async () => {
        let called = 0;
        const debounced = debounce(() => {
            called++;
        }, 20);

        debounced();
        await new Promise(resolve => setTimeout(resolve, 10));
        debounced(); 
        
        assert.strictEqual(called, 0);

        await new Promise(resolve => setTimeout(resolve, 25));
        assert.strictEqual(called, 1);
    });

    test('passes arguments correctly', async () => {
        let lastArg = '';
        const debounced = debounce((arg: string) => {
            lastArg = arg;
        }, 10);

        debounced('test');
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.strictEqual(lastArg, 'test');
    });
});
