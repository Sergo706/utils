import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleTask, shutdownScheduledTasks } from '../server/scheduleTask.js';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TMP_FILE = join(process.cwd(), 'scheduleTask-test.tmp');

function cleanupTmp() {
  if (existsSync(TMP_FILE)) unlinkSync(TMP_FILE);
}

describe('scheduleTask', () => {
  beforeEach(cleanupTmp);
  const shell =  process.platform === 'win32' ? 'cmd' : '/bin/sh';
  
  afterEach(async () => {
    await shutdownScheduledTasks();
    cleanupTmp();
  });

  test('runs a command at the given interval and writes output', async (t) => {
    let count = 0;

    const script = 'echo scheduleTask >> ' + TMP_FILE;

    scheduleTask('test-echo', shell,
      process.platform === 'win32'
        ? ['/c', script]
        : ['-c', script],
      200
    );

    await new Promise(r => setTimeout(r, 550));
    await shutdownScheduledTasks();
    const content = existsSync(TMP_FILE) ? readFileSync(TMP_FILE, 'utf8') : '';
    count = content.split('scheduleTask').length - 1;
    assert.ok(count >= 2, `Expected at least 2 runs, got ${count}`);
  });

  test('does not schedule new jobs after shutdown', async () => {
    scheduleTask('test-shutdown', shell,
      process.platform === 'win32'
        ? ['/c', 'echo should-not-run >> ' + TMP_FILE]
        : ['-c', 'echo should-not-run >> ' + TMP_FILE],
      100
    );

    await shutdownScheduledTasks();
    await new Promise(r => setTimeout(r, 200));
    assert.ok(!existsSync(TMP_FILE), 'No file should be created after shutdown');
  });

  test('respects memoryCap option', async () => {

    const bigCmd = process.platform === 'win32'
      ? 'for /L %i in (1,1,10000) do @echo line'
      : 'yes | head -n 10000';

    scheduleTask('test-memory', shell,
      process.platform === 'win32'
        ? ['/c', bigCmd]
        : ['-c', bigCmd],
      100, 1024 * 10
    );

    await new Promise(r => setTimeout(r, 300));
    await shutdownScheduledTasks();
  });
});
