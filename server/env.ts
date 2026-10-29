function raw(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** How `envInt` / `envFloat` react to a value that parses but is out of range. */
export type EnvRangeFallback = "fallback" | "clamp";

/** Range options shared by {@link envInt} and {@link envFloat}. */
export interface EnvNumberOptions {
  /** Inclusive lower bound. Defaults to `-Infinity`. */
  min?: number;
  /** Inclusive upper bound. Defaults to `Infinity`. */
  max?: number;
  /**
   * `"fallback"` (default) returns the caller's default when the value is out
   * of range. `"clamp"` returns the nearest bound instead, which keeps a typo'd
   * value from silently disabling a feature.
   */
  onRangeError?: EnvRangeFallback;
}

function applyRange(
  parsed: number,
  fallback: number,
  {
    min = -Infinity,
    max = Infinity,
    onRangeError = "fallback",
  }: EnvNumberOptions,
): number {
  if (min > max) return fallback;
  if (parsed >= min && parsed <= max) return parsed;
  if (onRangeError === "clamp") return parsed < min ? min : max;
  return fallback;
}

/**
 * Reads an integer environment variable. Falls back when missing, empty,
 * non-numeric, non-integer or out of range.
 *
 * `" 42 "`, `1e3` and `0x10` are accepted because `Number` understands them;
 * `"12.5"`, `"abc"`, `""` and `"Infinity"` are not.
 *
 * @param name - Environment variable name.
 * @param fallback - Returned when the value is unusable.
 * @param options - Inclusive bounds and out-of-range behavior.
 * @returns The parsed integer, the nearest bound when `onRangeError` is
 *   `"clamp"`, or `fallback`.
 *
 * @example
 * const port = envInt('PORT', 3000, { min: 1, max: 65535 });
 * const retries = envInt('RETRIES', 3, { min: 1, onRangeError: 'clamp' });
 */
export function envInt(
  name: string,
  fallback: number,
  options: EnvNumberOptions = {},
): number {
  const value = raw(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return fallback;
  return applyRange(parsed, fallback, options);
}

/**
 * Reads a float environment variable. Falls back when missing, empty,
 * non-numeric or out of range.
 *
 * `NaN` and `Infinity` are rejected here; use {@link envIntOrInfinity} when
 * "unbounded" is itself a meaningful setting.
 *
 * @param name - Environment variable name.
 * @param fallback - Returned when the value is unusable.
 * @param options - Inclusive bounds and out-of-range behavior.
 * @returns The parsed float, the nearest bound when `onRangeError` is
 *   `"clamp"`, or `fallback`.
 *
 * @example
 * const threshold = envFloat('SIMILARITY_THRESHOLD', 0.9, { min: 0, max: 1 });
 */
export function envFloat(
  name: string,
  fallback: number,
  options: EnvNumberOptions = {},
): number {
  const value = raw(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return applyRange(parsed, fallback, options);
}

/**
 * Reads a positive integer, or `Infinity` when the variable is explicitly
 * `infinity`, `inf` or `none` (case-insensitive, whitespace ignored).
 *
 * Any other value goes through {@link envInt} with a minimum of 1, so `0` and
 * negative numbers fall back instead of reaching a loop as a zero budget.
 *
 * @param name - Environment variable name.
 * @param fallback - Returned when the value is unusable.
 * @returns The parsed integer, `Infinity` for a sentinel, or `fallback`.
 *
 * @example
 * // MAX_ITEMS=none means "no limit"
 * const maxItems = envIntOrInfinity('MAX_ITEMS', 100);
 */
export function envIntOrInfinity(name: string, fallback: number): number {
  const value = raw(name)?.toLowerCase();
  if (value === "infinity" || value === "inf" || value === "none") {
    return Infinity;
  }
  return envInt(name, fallback, { min: 1 });
}

/**
 * Reads a string environment variable. The value is trimmed; inner whitespace
 * and case are preserved.
 *
 * @param name - Environment variable name.
 * @param fallback - Returned when the variable is missing or whitespace-only.
 * @returns The trimmed value, or `fallback`.
 *
 * @example
 * const region = envStr('AWS_REGION', 'eu-central-1');
 */
export function envStr(name: string, fallback: string): string {
  return raw(name) ?? fallback;
}

/**
 * Reads a comma-separated list, trimmed and lower-cased, with blanks dropped.
 *
 * Duplicates are kept, so `"a,a,b"` yields `["a", "a", "b"]`.
 *
 * @param name - Environment variable name.
 * @param fallback - Returned as a fresh copy when the variable is missing or
 *   holds only separators. Defaults to `[]`.
 * @returns The parsed list, or a copy of `fallback`. The returned array is
 *   always a new instance, so mutating it never affects `fallback`.
 *
 * @example
 * // Unset variable with no fallback
 * assert.deepStrictEqual(envList('RIAVZON_TEST_ENV'), []);
 *
 * @example
 * const suffixes = envList('TRUSTED_SUFFIXES', ['gov']);
 */
export function envList(
  name: string,
  fallback: readonly string[] = [],
): string[] {
  const value = raw(name);
  if (value === undefined) return [...fallback];
  const items = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return items.length > 0 ? items : [...fallback];
}

/**
 * Reads a boolean environment variable.
 *
 * `true` / `1` / `yes` / `on` are true and `false` / `0` / `no` / `off` are
 * false, all case-insensitive. Anything else — including a typo such as
 * `ture` — falls back rather than guessing, so a mistake cannot silently flip a
 * safety switch.
 *
 * @param name - Environment variable name.
 * @param fallback - Returned for missing, blank or unrecognized values.
 * @returns `true`, `false`, or `fallback`.
 *
 * @example
 * const bypassCache = envBool('BYPASS_CACHE', false);
 */
export function envBool(name: string, fallback: boolean): boolean {
  const value = raw(name)?.toLowerCase();
  if (value === undefined) return fallback;
  if (["true", "1", "yes", "on"].includes(value)) return true;
  if (["false", "0", "no", "off"].includes(value)) return false;
  return fallback;
}

/**
 * Reads a variable that must be present and non-blank.
 *
 * This is the only throwing getter in the module. Use it for credentials,
 * connection strings and anything else where a silent fallback would hide the
 * misconfiguration until the first request arrives.
 *
 * @param name - Environment variable name.
 * @returns The trimmed value.
 * @throws {Error} When the variable is missing, blank or whitespace-only.
 *
 * @example
 * const databaseUrl = envRequired('DATABASE_URL');
 */
export function envRequired(name: string): string {
  const value = raw(name);
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
