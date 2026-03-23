import { ZodSafeParseSuccess, type ZodType } from 'zod';
import * as z from 'zod';
import pino from 'pino';

interface CustomValidationError { valid: false; errors: Record<string, string> };

/**
 * Validates data against a Zod schema and provides detailed error reporting.
 * 
 * - Logs the validation process using the provided logger.
 * - If validation fails, it prettifies the error and returns a simplified `errors` object.
 * - If validation succeeds, it returns the standard Zod success result.
 * 
 * @template T - The schema's output type.
 * @template Input - The schema's input type.
 * @param schema - The Zod schema to validate against.
 * @param data - The data to validate.
 * @param log - Logger instance for tracking validation steps and errors.
 * @returns A Zod success result or a custom validation error object.
 */

export function validateZodSchema<T, Input>(schema: ZodType<T, Input>,data: Input, log: pino.Logger)
: ZodSafeParseSuccess<T> | CustomValidationError {
    log.info(`Validating schema...`);
    const result = schema.safeParse(data);
    
    if (!result.success) {
        const prettyError = z.prettifyError(result.error);
        log.error(`Error validating data ${prettyError}`);
        const errors: Record<string,string> = {};
            
        result.error.issues.forEach(issue => {
              const key = issue.path[0]?.toString() ?? 'root';
              errors[`${key} Error`] = issue.message;
        });
            return {
                valid: false,
                errors: errors
            };
    }
    log.info(`Schema parsed`);
    return result;
} 