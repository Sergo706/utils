import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getRoot, resolvePath } from '../server/pathResolver.js';



function makeTmpTree(structure: Record<string, string | null>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pathResolver-'));
  for (const [rel, content] of Object.entries(structure)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (content !== null) fs.writeFileSync(abs, content);
  }
  return root;
}


describe('getRoot', () => {
  test('finds package.json walking up from a nested dir', () => {
    const tmp = makeTmpTree({
      'package.json': '{}',
      'a/b/c/.gitkeep': '',
    });
    try {
      const result = getRoot(path.join(tmp, 'a', 'b', 'c'));
      assert.strictEqual(result, tmp);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('returns the start dir when marker is already there', () => {
    const tmp = makeTmpTree({ 'package.json': '{}' });
    try {
      assert.strictEqual(getRoot(tmp), tmp);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('supports a custom marker file', () => {
    const tmp = makeTmpTree({
      'MY_MARKER': '',
      'sub/dir/.gitkeep': '',
    });
    try {
      const result = getRoot(path.join(tmp, 'sub', 'dir'), 'MY_MARKER');
      assert.strictEqual(result, tmp);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('throws when marker is never found', () => {
    const tmp = makeTmpTree({ 'sub/dir/.gitkeep': '' });
    try {
      assert.throws(
        () => getRoot(path.join(tmp, 'sub', 'dir'), '__nonexistent_marker_xyz__'),
        /Could not find root/,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('works from the actual repo root', () => {
    const result = getRoot();
    assert.ok(fs.existsSync(path.join(result, 'package.json')));
  });
});

describe('resolveDataPath', () => {
  let tmp: string;
  before(() => {
    tmp = makeTmpTree({
      'package.json': '{}',
      'data/foo.mmdb': 'content',
    });
  });

  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('resolves a file found in the first search dir', () => {
    const result = resolvePath('foo.mmdb', ['data', 'dist/data'], [], tmp);
    assert.strictEqual(result, path.join(tmp, 'data', 'foo.mmdb'));
  });

  test('resolves a file found in a later search dir', () => {
    fs.mkdirSync(path.join(tmp, 'dist', 'data'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'dist', 'data', 'bar.mmdb'), '');

    const result = resolvePath('bar.mmdb', ['data', 'dist/data'], [], tmp);
    assert.strictEqual(result, path.join(tmp, 'dist', 'data', 'bar.mmdb'));
  });

  test('throws when file is missing and not optional', () => {
    assert.throws(
      () => resolvePath('missing.mmdb', ['data'], [], tmp),
      /File "missing\.mmdb" not found/,
    );
  });

  test('returns empty string when file is missing but listed as optional', () => {
    const result = resolvePath('missing.mmdb', ['data'], ['missing.mmdb'], tmp);
    assert.strictEqual(result, '');
  });
});
