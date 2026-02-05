/**
 * Debounces a function, ensuring it only executes after a specified delay since the last call.
 * Each call to `debounce` returns a new debounced instance with its own isolated timer.
 * 
 * @param action - The function to be debounced.
 * @param debounceMs - The delay in milliseconds default is 300ms.
 * @returns A debounced version of the function.
 * 
 * @example
 * const log = (msg: string) => console.log(msg);
 * const debouncedLog = debounce(log, 500);
 * 
 * debouncedLog('test 1'); // Timer starts
 * debouncedLog('test 2'); // Timer resets
 * // 500ms later: "test 2"
 */
export function debounce<T extends (...args: any[]) => any>(
    action: T,
    debounceMs: number = 300
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            timeoutId = null;
            action(...args);
        }, debounceMs);
    };
}