
/**
 * Processes an array in chunks.
 *
 * @param items The array to process.
 * @param chunkSize The size of each chunk. Must be greater than 0.
 * @param processor A function to process each chunk. Can be async.
 * @example
 * ```ts
 * const allPostIds = [1, 2, 3, 4, 5];
 * await chunkProcess(allPostIds, 2, async (chunkIds) => {
 *   await db.update(posts).where(inArray(posts.id, chunkIds));
 * });
 * ```
 */
export async function chunkProcess<T>(
  items: T[],
  chunkSize: number,
  processor: (chunk: T[], index: number) => Promise<void> | void
): Promise<void> {
  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than 0');
  }

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await processor(chunk, i);
  }
}