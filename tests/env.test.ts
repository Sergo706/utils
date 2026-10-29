import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
    envBool,
    envFloat,
    envInt,
    envIntOrInfinity,
    envList,
    envRequired,
    envStr,
} from '../server/env.js';

const KEY = 'RIAVZON_TEST_ENV';

const saved: Record<string, string | undefined> = {};

function setEnv(value: string): void {
    process.env[KEY] = value;
}

function clearAll(...extra: string[]): void {
    delete process.env[KEY];
    for (const name of extra) delete process.env[name];
}

beforeEach(() => {
    saved[KEY] = process.env[KEY];
    delete process.env[KEY];
});

afterEach(() => {
    if (saved[KEY] === undefined) delete process.env[KEY];
    else process.env[KEY] = saved[KEY];
});

describe('envInt', () => {
    test('returns the parsed integer', () => {
        setEnv('42');
        assert.strictEqual(envInt(KEY, 7), 42);
    });

    test('trims surrounding whitespace', () => {
        setEnv('   42   ');
        assert.strictEqual(envInt(KEY, 7), 42);
    });

    test('accepts exponent and hex notation that Number understands', () => {
        setEnv('1e3');
        assert.strictEqual(envInt(KEY, 0), 1000);
        setEnv('0x10');
        assert.strictEqual(envInt(KEY, 0), 16);
    });

    test('accepts negatives when no minimum is given', () => {
        setEnv('-5');
        assert.strictEqual(envInt(KEY, 0), -5);
    });

    test('falls back when the variable is missing', () => {
        assert.strictEqual(envInt(KEY, 7), 7);
    });

    test('falls back when the variable is blank or whitespace only', () => {
        setEnv('');
        assert.strictEqual(envInt(KEY, 7), 7);
        setEnv('   ');
        assert.strictEqual(envInt(KEY, 7), 7);
    });

    test('falls back for non-numeric values', () => {
        for (const value of ['abc', '12abc', 'true', 'NaN', 'Infinity']) {
            setEnv(value);
            assert.strictEqual(envInt(KEY, 7), 7, `value: ${value}`);
        }
    });

    test('falls back for non-integers', () => {
        for (const value of ['12.5', '0.1', '-3.2']) {
            setEnv(value);
            assert.strictEqual(envInt(KEY, 7), 7, `value: ${value}`);
        }
    });

    test('falls back when below min or above max', () => {
        setEnv('3');
        assert.strictEqual(envInt(KEY, 7, { min: 5 }), 7);
        assert.strictEqual(envInt(KEY, 7, { max: 2 }), 7);
    });

    test('accepts the exact bounds', () => {
        setEnv('5');
        assert.strictEqual(envInt(KEY, 0, { min: 5, max: 5 }), 5);
    });

    test('clamps when onRangeError is clamp', () => {
        setEnv('1');
        assert.strictEqual(envInt(KEY, 7, { min: 5, onRangeError: 'clamp' }), 5);
        setEnv('99');
        assert.strictEqual(envInt(KEY, 7, { max: 10, onRangeError: 'clamp' }), 10);
    });

    test('clamp does not resurrect a non-numeric value', () => {
        setEnv('abc');
        assert.strictEqual(envInt(KEY, 7, { min: 5, onRangeError: 'clamp' }), 7);
    });

    test('falls back when min is greater than max', () => {
        setEnv('5');
        assert.strictEqual(envInt(KEY, 7, { min: 10, max: 1 }), 7);
    });
});

describe('envFloat', () => {
    test('returns the parsed float', () => {
        setEnv('0.65');
        assert.strictEqual(envFloat(KEY, 0.1), 0.65);
    });

    test('accepts negatives and exponents', () => {
        setEnv('-1.5');
        assert.strictEqual(envFloat(KEY, 0), -1.5);
        setEnv('2e-3');
        assert.strictEqual(envFloat(KEY, 0), 0.002);
    });

    test('falls back when missing or blank', () => {
        assert.strictEqual(envFloat(KEY, 0.5), 0.5);
        setEnv('  ');
        assert.strictEqual(envFloat(KEY, 0.5), 0.5);
    });

    test('rejects NaN and Infinity', () => {
        for (const value of ['NaN', 'Infinity', '-Infinity', 'abc']) {
            setEnv(value);
            assert.strictEqual(envFloat(KEY, 0.5), 0.5, `value: ${value}`);
        }
    });

    test('falls back when out of range', () => {
        setEnv('1.4');
        assert.strictEqual(envFloat(KEY, 0, { min: -1, max: 1 }), 0);
    });

    test('clamps when onRangeError is clamp', () => {
        setEnv('1.4');
        assert.strictEqual(
            envFloat(KEY, 0, { min: -1, max: 1, onRangeError: 'clamp' }),
            1,
        );
        setEnv('-3');
        assert.strictEqual(
            envFloat(KEY, 0, { min: -1, max: 1, onRangeError: 'clamp' }),
            -1,
        );
    });
});

describe('envIntOrInfinity', () => {
    test('returns Infinity for infinity, inf and none in any case', () => {
        for (const value of ['infinity', 'INFINITY', 'Infinity', 'inf', 'INF', 'none', 'NONE', ' none ']) {
            setEnv(value);
            assert.strictEqual(
                envIntOrInfinity(KEY, 5),
                Infinity,
                `value: ${value}`,
            );
        }
    });

    test('returns the integer for a normal value', () => {
        setEnv('12');
        assert.strictEqual(envIntOrInfinity(KEY, 5), 12);
    });

    test('falls back for zero and negatives because the minimum is 1', () => {
        setEnv('0');
        assert.strictEqual(envIntOrInfinity(KEY, 5), 5);
        setEnv('-2');
        assert.strictEqual(envIntOrInfinity(KEY, 5), 5);
    });

    test('falls back for garbage', () => {
        setEnv('forever');
        assert.strictEqual(envIntOrInfinity(KEY, 5), 5);
    });

    test('falls back when missing', () => {
        assert.strictEqual(envIntOrInfinity(KEY, 5), 5);
    });
});

describe('envStr', () => {
    test('returns the trimmed value', () => {
        setEnv('  hello  ');
        assert.strictEqual(envStr(KEY, 'fallback'), 'hello');
    });

    test('falls back when missing or blank', () => {
        assert.strictEqual(envStr(KEY, 'fallback'), 'fallback');
        setEnv('');
        assert.strictEqual(envStr(KEY, 'fallback'), 'fallback');
        setEnv('    ');
        assert.strictEqual(envStr(KEY, 'fallback'), 'fallback');
    });

    test('preserves inner whitespace and case', () => {
        setEnv('Hello World');
        assert.strictEqual(envStr(KEY, ''), 'Hello World');
    });
});

describe('envList', () => {
    test('splits, trims and lower-cases', () => {
        setEnv('a, B ,,c ');
        assert.deepStrictEqual(envList(KEY), ['a', 'b', 'c']);
    });

    test('returns an empty array when missing and no fallback given', () => {
        assert.deepStrictEqual(envList(KEY), []);
    });

    test('returns a copy of the fallback when missing', () => {
        const fallback = ['x', 'y'];
        const result = envList(KEY, fallback);
        assert.deepStrictEqual(result, ['x', 'y']);
        result.push('z');
        assert.deepStrictEqual(fallback, ['x', 'y'], 'fallback must not be mutated');
    });

    test('returns a copy of the fallback when the variable holds only commas', () => {
        setEnv(', ,,');
        assert.deepStrictEqual(envList(KEY, ['x']), ['x']);
    });

    test('keeps a single value without a comma', () => {
        setEnv('solo');
        assert.deepStrictEqual(envList(KEY), ['solo']);
    });

    test('does not deduplicate', () => {
        setEnv('a,a,b');
        assert.deepStrictEqual(envList(KEY), ['a', 'a', 'b']);
    });
});

describe('envBool', () => {
    test('treats true, 1, yes and on as true', () => {
        for (const value of ['true', 'TRUE', '1', 'yes', 'YES', 'on', ' On ']) {
            setEnv(value);
            assert.strictEqual(envBool(KEY, false), true, `value: ${value}`);
        }
    });

    test('treats false, 0, no and off as false', () => {
        for (const value of ['false', 'FALSE', '0', 'no', 'NO', 'off', ' Off ']) {
            setEnv(value);
            assert.strictEqual(envBool(KEY, true), false, `value: ${value}`);
        }
    });

    test('falls back when missing or blank', () => {
        assert.strictEqual(envBool(KEY, true), true);
        assert.strictEqual(envBool(KEY, false), false);
        setEnv('   ');
        assert.strictEqual(envBool(KEY, true), true);
    });

    test('falls back for a typo rather than guessing', () => {
        for (const value of ['ture', 'yess', 'nope', 'enabled', '2']) {
            setEnv(value);
            assert.strictEqual(envBool(KEY, true), true, `value: ${value}`);
        }
    });
});

describe('envRequired', () => {
    test('returns the trimmed value when present', () => {
        setEnv('  secret-key  ');
        assert.strictEqual(envRequired(KEY), 'secret-key');
    });

    test('throws when missing', () => {
        assert.throws(() => envRequired(KEY), /Missing required environment variable/);
    });

    test('throws when blank or whitespace only', () => {
        setEnv('');
        assert.throws(() => envRequired(KEY), /Missing required environment variable/);
        setEnv('   ');
        assert.throws(() => envRequired(KEY), /Missing required environment variable/);
    });

    test('names the variable in the error message', () => {
        assert.throws(() => envRequired(KEY), new RegExp(KEY));
    });
});

describe('empty-string handling is uniform', () => {
    test('every total getter falls back for blank input', () => {
        setEnv('');
        assert.strictEqual(envInt(KEY, 1), 1);
        assert.strictEqual(envFloat(KEY, 1.5), 1.5);
        assert.strictEqual(envIntOrInfinity(KEY, 3), 3);
        assert.strictEqual(envStr(KEY, 'x'), 'x');
        assert.deepStrictEqual(envList(KEY, ['d']), ['d']);
        assert.strictEqual(envBool(KEY, true), true);
    });

    test('clearAll removes the key used by the suite', () => {
        setEnv('1');
        clearAll();
        assert.strictEqual(process.env[KEY], undefined);
    });
});
