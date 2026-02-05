import { test, describe } from 'node:test';
import assert from 'node:assert';
import { chunkProcess } from '../generic/chunckProcess.js';

describe('chunkProcess', () => {
  test('processes items in correct chunk sizes', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const chunks: number[][] = [];
    
    await chunkProcess(items, 3, (chunk: number[]) => {
      chunks.push(chunk);
    });

    assert.strictEqual(chunks.length, 3);
    assert.deepStrictEqual(chunks[0], [1, 2, 3]);
    assert.deepStrictEqual(chunks[1], [4, 5, 6]);
    assert.deepStrictEqual(chunks[2], [7]);
  });

  test('handles empty arrays', async () => {
    const items: number[] = [];
    let called = false;
    
    await chunkProcess(items, 2, () => {
      called = true;
    });

    assert.strictEqual(called, false);
  });

  test('throws error for invalid chunk size', async () => {
    const items = [1, 2, 3];
    
    await assert.rejects(
      async () => await chunkProcess(items, 0, () => {}),
      { message: 'chunkSize must be greater than 0' }
    );
  });

  test('awaits async processor', async () => {
    const items = [1, 2, 3, 4];
    const processed: number[] = [];
    
    await chunkProcess(items, 2, async (chunk: number[]) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      processed.push(...chunk);
    });

    assert.deepStrictEqual(processed, [1, 2, 3, 4]);
  });

  test('provides correct index to processor', async () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const indices: number[] = [];
    
    await chunkProcess(items, 2, (_: string[], index: number) => {
      indices.push(index);
    });

    assert.deepStrictEqual(indices, [0, 2, 4]);
  });

  test('propagates error from processor', async () => {
    const items = [1, 2, 3];
    await assert.rejects(async () => {
       await chunkProcess(items, 1, async () => {
          throw new Error('Processor failed');
       });
    }, /Processor failed/);
  });
});
