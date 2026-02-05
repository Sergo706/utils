import { test, describe } from 'node:test';
import assert from 'node:assert';
import { safeAction } from '../generic/promiseLocker.js';

const fakeLogger: any = {
    info: () => {},
    debug: () => {},
    error: () => {},
    child: () => fakeLogger
};

describe('promiseLocker', () => {
    test('executes action', async () => {
        const result = await safeAction('token1', async () => 'success', 1000, fakeLogger);
        assert.strictEqual(result, 'success');
    });

    test('deduplicates concurrent calls', async () => {
        let calls = 0;
        const action = async () => {
            calls++;
            await new Promise(resolve => setTimeout(resolve, 50));
            return 'result';
        };

        const [r1, r2] = await Promise.all([
            safeAction('token2', action, 1000, fakeLogger),
            safeAction('token2', action, 1000, fakeLogger)
        ]);

        assert.strictEqual(calls, 1);
        assert.strictEqual(r1, 'result');
        assert.strictEqual(r2, 'result');
    });

    test('uses cache for subsequent calls', async () => {
        let calls = 0;
        const action = async () => {
            calls++;
            return 'result';
        };

        await safeAction('token3', action, 1000, fakeLogger);
        const r2 = await safeAction('token3', action, 1000, fakeLogger);

        assert.strictEqual(calls, 1);
        assert.strictEqual(r2, 'result');
    });

    test('releases lock on error', async () => {
        let calls = 0;
        const action = async () => {
            calls++;
            throw new Error('fail');
        };


        await assert.rejects(async () => {
            await safeAction('token_error', action, 1000, fakeLogger);
        }, /fail/);

        
        let calls2 = 0;
        const action2 = async () => {
            calls2++;
            return 'success';
        };

        const result = await safeAction('token_error', action2, 1000, fakeLogger);
        assert.strictEqual(result, 'success');
        assert.strictEqual(calls2, 1);
    });
    
    test('respects cache ttl', async () => {
         let calls = 0;
         const action = async () => {
             calls++;
             return 'cached';
         };
         
         await safeAction('token_ttl', action, 50, fakeLogger); 
         await safeAction('token_ttl', action, 50, fakeLogger); 
         assert.strictEqual(calls, 1);
         
         await new Promise(resolve => setTimeout(resolve, 60));
         
         await safeAction('token_ttl', action, 50, fakeLogger);
         assert.strictEqual(calls, 2);
    });
});
