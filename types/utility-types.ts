/**
 * Forcefully expands a type definition to reveal its keys and values.
 * Useful for debugging complex intersections in IDE tooltips.
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Recursively makes all properties of an object optional.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Creates a "Branded" type (Nominal Typing) to distinguish primitives.
 * 
 * @example
 * type USDE = Brand<number, 'USD'>;
 * type EUR = Brand<number, 'EUR'>;
 * 
 * const dollars = 10 as USD;
 * const euros = 10 as EUR;
 * // dollars = euros; // Error!
 */
export type Brand<K, T> = K & { __brand: T };

/**
 * Merges two types, where the second type overrides the first.
 * Cleaner than `A & B` for overlapping keys.
 */
export type Merge<FirstType, SecondType> = Omit<FirstType, keyof SecondType> & SecondType;

/**
 * Extracts the value types from an object (similar to `keyof` but for values).
 */
export type ValueOf<T> = T[keyof T];

/**
 * Removes `null` and `undefined` from a type.
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Makes specified keys of T required (opposite of Partial).
 */
export type RequireKeys<T, K extends keyof T> = T & { [P in K]-?: T[P] };

/**
 * Extracts the resolved type of a Promise.
 */
export type PromiseType<T> = T extends Promise<infer U> ? U : T;
