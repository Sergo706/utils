import { test, describe } from 'node:test';
import assert from 'node:assert';
import { run } from '../generic/run.js';
import path from 'node:path';
import os from 'node:os';

describe('run', () => {
  test('executes a command and returns stdout', async () => {
    const result = await run('echo "hello world"');
    assert.strictEqual(typeof result.stdout, 'string');
    assert.strictEqual(result.stdout, 'hello world');
    assert.strictEqual(result.stderr, '');
  });

  test('captures stderr', async () => {
    const result = await run('echo "error message" >&2');
    assert.strictEqual(result.stderr, 'error message');
  });

  test('handles failing commands by throwing', async () => {
    await assert.rejects(async () => {
      await run('exit 1');
    }, (err: any) => {
      assert.notStrictEqual(err, null);
      return true;
    });
  });

  test('supports custom environment variables', async () => {
    const result = await run('echo $CUSTOM_ENV_VAR', {
      env: { ...process.env, CUSTOM_ENV_VAR: 'test' }
    });
    assert.strictEqual(result.stdout, 'test');
  });

  test('supports custom working directory', async () => {
    const tmpDir = os.tmpdir();
    const result = await run('pwd', { cwd: tmpDir });
    
    const resolvedStdout = path.resolve(result.stdout.toString());
    const resolvedTmpDir = path.resolve(tmpDir);
    
    assert.strictEqual(resolvedStdout, resolvedTmpDir);
  });

  test('handles maxBuffer option', async () => {
    await assert.rejects(async () => {
      await run('echo "this is a long string"', { maxBuffer: 5 });
    }, (err: any) => {
      return err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
    });
  });
});
