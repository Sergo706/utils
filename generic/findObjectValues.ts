
/**
 * Recursively searches an object tree for a string matching specific key and value criteria.
 * 
 * - Prevents infinite recursion using a `visited` Set for circular references.
 * - Supports depth-limited traversal (default: 6) to avoid stack overflows on massive objects.
 * - Matches if the key (case-insensitive) contains the search term AND the value matches the regex,
 *   OR if the value simply matches the regex.
 *
 * @param input - The object tree to search.
 * @param visited - Internal set for tracking visited objects (prevents circularity).
 * @param searchTerms - The matching criteria.
 * @param searchTerms.keyToSearch - The substring to look for in object keys (case-insensitive).
 * @param searchTerms.value - The RegExp to test against string values.
 * @param depth - Current recursion depth (internal).
 * @param maxDepth - Maximum recursion depth (default: 6).
 * @returns The first matching string value (trimmed) or null if no match is found.
 *
 * @example
 * const email = findStringsInObject(payload, new Set(), { 
 *   keyToSearch: 'email', 
 *   value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
 * });
 */
export function findStringsInObject(
  input: object,
  visited = new Set<object>(),
  searchTerms: {keyToSearch: string, value: RegExp},
  depth = 0,
  maxDepth = 6
): string | null {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!input || visited.has(input) || depth > maxDepth) return null;

  visited.add(input);

  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v === "string") {
      if (k.toLowerCase().includes(searchTerms.keyToSearch) && searchTerms.value.test(v.trim())) return v.trim();
      if (searchTerms.value.test(v.trim())) return v.trim();

    } else if (v && typeof v === "object") {
      const found = findStringsInObject(v, visited, searchTerms, depth + 1, maxDepth);
      if (found) return found;
    }
  }
  return null;
}