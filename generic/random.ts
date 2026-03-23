



/**
 * Utility class for generating random values.
 */
export class Random {

    /**
     * Returns a random integer between 0 and max.
     * @param max - The upper bound (default: 100).
     */
    getRandomInt(max = 100): number {
        return Math.floor(Math.random() * max);
    }

    /**
     * Returns a random integer between min and max.
     * @param min - The lower bound (default: 1).
     * @param max - The upper bound (default: 10).
     */
    getRandomArbitrary(min = 1, max = 10): number {
        return Math.floor(Math.random() * (max - min)) + min;
    }
    
    /**
     * Returns a random element from an array.
     * @param array - The array to pick from.
     * @returns A random element or undefined if empty.
     */
    getRandomElement<T>(array: T[]): T | undefined {
          if (array.length === 0) {
                return undefined;
          }
        return array[Math.floor(Math.random() * array.length)];
    }
}
