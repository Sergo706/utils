/**
 * Truncates a string if it exceeds the specified maximum length.
 * 
 * @param text - The string to truncate.
 * @param maxLength - The maximum length of the string after truncation (excluding ellipsis).
 * @returns The truncated string with an ellipsis if it was truncated, otherwise the original string.
 * 
 * @example
 * textTruncation('Hello World', 5); // 'Hello...'
 */
export default function textTruncation(text: string, maxLength: number) {
    if (text.length > maxLength) {
        return `${text.slice(0, maxLength)}...`;
    }
    return text;
}