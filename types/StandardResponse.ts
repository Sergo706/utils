/**
 * Represents a successful operation or API response.
 *
 * @template T - The type of the payload data returned in the response.
 */
interface Success<T> {
    /** Indicates that the operation was successful. */
    ok: true;
    /** The date and time when the response was generated (usually an ISO 8601 string). */
    date: string;
    /** The payload containing the requested data. */
    data: T;
}

/**
 * Represents a failed operation or API response.
 */
export interface ApiError {
    /** Indicates that the operation failed. */
    ok: false;
    /** The date and time when the error occurred (usually an ISO 8601 string). */
    date: string;
    /** A descriptive message explaining the reason for the failure. */
    reason: string;
}

/**
 * A discriminated union representing the final result of an operation or API call.
 * It resolves to either a `Success` object containing the requested data or an `ApiError` object detailing the failure.
 *
 * @template T - The type of the data expected upon success. Defaults to `unknown`.
 */
export type Results<T = unknown> = Success<T> | ApiError;