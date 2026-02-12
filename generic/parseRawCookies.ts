
/**
 * Parses raw cookies from various formats into a key-value record.
 * 
 * This utility can handle:
 * - A single cookie string (e.g., "id=123; name=John")
 * - An array of cookie strings (e.g., ["id=123", "name=John"])
 * - An existing cookie object (Record) which it will normalize
 * 
 * Values are automatically URI-decoded.
 * 
 * @param cookies - The cookies to parse, either as a Record, an array of strings, or a single string.
 * @returns A record of cookies where keys are names and values are strings or numbers.
 * 
 * @example
 * ```typescript
 * // From string
 * parseCookies("theme=dark; user=sergio"); // { theme: "dark", user: "sergio" }
 * 
 * // From array
 * parseCookies(["id=1", "session=xyz"]); // { id: "1", session: "xyz" }
 * 
 * // From object
 * parseCookies({ count: 1, active: "true" }); // { count: 1, active: "true" }
 * ```
 */
export function parseCookies(cookies: Record<string, unknown> | string[] | string): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  const ATTRIBUTES = new Set([
    'path',
    'domain',
    'expires',
    'max-age',
    'samesite',
    'secure',
    'httponly',
    'partitioned',
    'priority'
  ]);

  const parsePair = (pair: string) => {
    const [name, val] = pair.split('=');
    if (name) {
      const trimmedName = name.trim();
      if (trimmedName && !ATTRIBUTES.has(trimmedName.toLowerCase())) {
        result[trimmedName] = decodeURIComponent(val?.trim() || '');
      }
    }
  };

  if (Array.isArray(cookies)) {
    cookies.forEach((cookie) => {
      const [main] = cookie.split(';');
      parsePair(main);
    });
  } else if (typeof cookies === 'string') {
    cookies.split(';').forEach(parsePair);
  } else if (typeof cookies === 'object' && cookies !== null) {
    for (const [key, value] of Object.entries(cookies)) {
      if (typeof value === 'string' || typeof value === 'number') {
        result[key] = value;
      } else {
        result[key] = String(value);
      }
    }
  }

  return result;
}
