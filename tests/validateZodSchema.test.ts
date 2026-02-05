import { test, describe } from 'node:test';
import assert from 'node:assert';
import { z } from 'zod';
import { validateZodSchema } from '../generic/validateZodSchema.js';


const fakeLogger: any = {
    info: () => {},
    error: () => {},
};

describe('validateZodSchema', () => {
    const schema = z.object({
        name: z.string(),
        age: z.number().min(0)
    });

    test('returns success for valid data', () => {
        const input = { name: 'Test', age: 10 };
        const result = validateZodSchema(schema, input, fakeLogger);
        
        assert.strictEqual('success' in result && result.success, true);
        if ('data' in result) {
            assert.deepStrictEqual(result.data, input);
        }
    });

    test('returns error for invalid data', () => {
        const input = { name: 'Test', age: -1 };
        const result = validateZodSchema(schema, input, fakeLogger);

        assert.strictEqual('valid' in result && result.valid, false);
        if ('errors' in result) {
            assert.ok(Object.keys(result.errors).length > 0);
        }
    });
});
