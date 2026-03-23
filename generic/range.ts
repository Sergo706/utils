/**
 * Creates an iterable range generator.
 * 
 * @param start - The baseline number.
 * @param end - The target end number (inclusive).
 * @param step - The increment step (default: 1).
 * @param inclusiveStart - If true, starts at `start`. If false (default), starts at `start + step`.
 * @returns An iterable object that yields the sequence.
 * 
 * @example
 * // Default: Starts at start + step
 * 
 * console.log(...range(0, 100)) // 1, 2, 3 ... 100
 * 
 * for (const a of range(0, 100)) {
 *  console.log(a)  // 1, 2, 3 ... 100
 * }
 * 
 * @example
 * // Inclusive start: Starts at start
 * console.log(...range(0, 100, 1, true)) // 0, 1, 2, 3 ... 100
 * 
 * for (const b of range(0, 100, 1, true)) {
 * console.log(b) // 0, 1, 2, 3 ... 100
 * }
 */
export function range(start: number, end: number, step = 1, inclusiveStart = false) {
    if (step <= 0) {
        throw new Error('step must be greater than 0');
    }
    let current = inclusiveStart ? start : start + step;

    return {
        [Symbol.iterator]() {
            return this;
        },
        next() {
            if (current <= end) {
                const value = current;
                current += step;
                return { value, done: false };
            }
            return { done: true, value: undefined };
        }
    };
}
