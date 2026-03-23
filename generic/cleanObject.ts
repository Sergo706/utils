/**
 * Recursively removes 'undefined' values and empty objects from a given object.
 * 
 * - Removes properties with 'undefined' values.
 * - Recursively cleans nested objects.
 * - Removes nested objects if they become empty after cleaning.
 * - Keeps nulls, booleans, numbers, and arrays (even if empty).
 * 
 * @template T - The type of the object being cleaned.
 * @param {T} target - The object to clean.
 * @param {WeakSet<object>} [visited] - A set to keep track of visited objects to prevent circular references.
 * @returns {Partial<T>} - A new object containing only the meaningful fields.
 */
export function cleanObject<T extends object>(
    target: T, 
    visited = new WeakSet()
): Partial<T> {

    if (visited.has(target)) {
        return {};
    }
    
    visited.add(target);

    const entries = Object.entries(target).map(([key, value]): [string, unknown] => {
        if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
            return [key, cleanObject(value as Record<string, unknown>, visited)];
        }
        return [key, value];
    });

    const cleaned = Object.fromEntries(
        entries.filter((entry) => {
            const value = entry[1];
            if (value === undefined) return false;
            if (value === null || typeof value !== 'object' || Array.isArray(value)) return true;
            return Object.keys(value as Record<string, unknown>).length > 0;
        })
    );

    return cleaned as Partial<T>;
}