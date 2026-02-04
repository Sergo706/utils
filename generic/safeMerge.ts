type MergeMode = "drop" | "throw";
/**
 * Safely merges properties from a source object into a target object while protecting reserved keys.
 * 
 * - Reserved keys in the `target` are never overwritten if they already have a value.
 * - If a reserved key is `null` or `undefined` in the `target`, it will be populated from the `src`.
 * - The `mode` option determines what happens on a conflict (default: "drop" - ignores the change).
 * 
 * @param target - The object to merge properties into. This object is modified directly.
 * @param src - The object containing the properties to merge.
 * @param opts - Configuration options for the merge.
 * @param opts.mode - "drop" (default) to ignore conflicts, or "throw" to raise an error.
 * @param opts.onConflict - Callback triggered when an attempt is made to overwrite a reserved key.
 * @param defaultToReserve - An array of keys that should be protected by default.
 * @param extraReserved - An optional additional set of keys to protect.
 * @returns The modified target object.
 * 
 * @example
 * const target = { id: 1, name: "Alice" };
 * const src = { id: 2, role: "admin" };
 * safeObjectMerge(target, src, { mode: "drop" }, ["id"]);
 * // result: { id: 1, name: "Alice", role: "admin" }
 */
export function safeObjectMerge(
  target: Record<string, unknown>,
  src: Record<string, unknown>,
  opts: { mode?: MergeMode; onConflict?: (key: string, incoming: unknown, existing: unknown) => void } = {},
  defaultToReserve: Array<string>,
  extraReserved?: Set<string>
) {

  const defaultReserved: ReadonlySet<string> = new Set<string>(defaultToReserve);

  const reserved = extraReserved ? new Set<string>([...defaultReserved, ...extraReserved]) : defaultReserved;
  const mode = opts.mode ?? "drop";

  for (const [key, value] of Object.entries(src)) {

    if (reserved.has(key)) {

      if (target[key] == null) {
        target[key] = value;
      } else {
        opts.onConflict?.(key, value, target[key]);
        if (mode === "throw") {
            throw new Error(`Attempted to overwrite reserved key "${key}"`);
        }
      }
      continue;
    } else {
      target[key] = value;
    }
  }
    return target;
}