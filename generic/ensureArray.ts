/**
 * Converts a string or an array of strings (possibly containing nulls) into a clean array of strings.
 * 
 * - Returns an empty array if the input is nullish or empty.
 * - Filters out `null` values if the input is an array.
 * - Wraps a single string into an array.
 * 
 * @param val - The input value to process.
 * @returns A clean array of strings.
 * 
 * @example
 * ensureArray(null) // []
 * ensureArray("hello") // ["hello"]
 * ensureArray(["a", null, "b"]) // ["a", "b"]
 */
export default function ensureArray(val: string | null | undefined | (string | null)[]): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val.filter((v): v is string => v !== null) : [val];
};