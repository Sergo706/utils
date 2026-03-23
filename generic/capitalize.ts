/**
 * Capitalizes the first letter of a string.
 * @param target - The string to capitalize.
 * @returns The string with the first letter uppercase.
 */
export function capitalize(target: string): string {
    return target.charAt(0).toUpperCase() + target.slice(1);
}

/**
 * Capitalizes the first letter of every word in a sentence (Title Case).
 * @param target - The sentence to capitalize.
 * @returns The sentence with every word capitalized.
 */
export function capitalizeSentence(target: string): string {
    const words = target.split(' ');
    const out: string[] = [];

    for (const word of words) {
         out.push(capitalize(word));
    }
    return out.join(' ');
}