

type DeepArray<T> = (T | DeepArray<T> | Record<string, unknown> | null | undefined | false | "" | 0)[];

/**
 * Filters out `null` and `undefined` values from an array.
 * Optionally performs a deep cleanup on nested arrays and objects.
 * 
 * @template T - The type of elements in the array.
 * @param array - The array to filter.
 * @param deep - If true, recursively cleans nested arrays and arrays found inside objects.
 * @returns A new array with `null` and `undefined` removed.
 * 
 * @example
 * // Shallow filter (default)
 * filterEmptyValues([1, null, undefined, 0, false, ""]) 
 * // Returns: [1, 0, false, ""]
 * 
 * @example
 * // Deep filter
 * const input = [1, null, { val: [2, null] }, [3, undefined]]
 * filterEmptyValues(input, true)
 * // Returns: [1, { val: [2] }, [3]]
 */
export function filterEmptyValues<T>(array: DeepArray<T>, deep = false): T[] {
    let filtered = array.filter(item => item !== null && item !== undefined) as unknown[];

    if (deep) {
        filtered = filtered.map(item => {
            if (Array.isArray(item)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return filterEmptyValues(item, true);
            }

            if (typeof item === 'object' && item !== null) {
                const cleanedObj: Record<string, unknown> = {};

                for (const [key, value] of Object.entries(item)) {
                    if (Array.isArray(value)) {
                        cleanedObj[key] = filterEmptyValues(value, true);
                    } 
                    else if (typeof value === 'object' && value !== null) {
                        const cleaned = filterEmptyValues([value], true);
                        cleanedObj[key] = cleaned.length > 0 ? cleaned[0] : value;
                    } else {
                        cleanedObj[key] = value;
                    }
                }
                return cleanedObj;
            }

            return item;
        });
    }

    return filtered as T[];
}