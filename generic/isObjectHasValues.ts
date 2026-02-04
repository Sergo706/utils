/**
 * Checks if an object has at least one meaningful value, searching recursively.
 * 
 * A value is considered "meaningful" if it is:
 * - Not undefined
 * - Not null
 * - Not an empty string ('')
 * - A non-empty array
 * - A nested object that itself has meaningful values
 * 
 * @param {Record<string, unknown>} target - The object to inspect.
 * @returns {boolean} - True if any meaningful value is found.
 */
export function isObjectHasValues(target: Record<string, unknown>): boolean {
    return Object.values(target).some((value: unknown) => {
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const nestedValues = Object.values(value as Record<string, unknown>);
            return nestedValues.some(v => v !== undefined && v !== null && v !== '');
        }

        if (Array.isArray(value)) {
            return value.length > 0;
        }
        
        return value !== undefined && value !== null && value !== '';
    });
}