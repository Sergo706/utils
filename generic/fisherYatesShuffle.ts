/**
 * Shuffles an array using the Fisher-Yates algorithm.
 * Returns a new array to preserve immutability.
 * 
 * @param array - The array to shuffle
 * @returns A new shuffled array
 * 
 * @example
 * import { range } from './range';
 * 
 * const input = [...range(0, 5)];
 * const shuffled = fisherYatesShuffle(input);
 * console.log(shuffled); // e.g. [3, 0, 4, 1, 2]
 */
export function fisherYatesShuffle<T>(array: T[]): T[] {
    const shuffled: T[] = [...array];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        
        const temp = shuffled[i];

        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
    }

    return shuffled;
}