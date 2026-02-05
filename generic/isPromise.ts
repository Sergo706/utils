/**
 * Checks if the given input is an asynchronous function or a Promise.
 * 
 * @param input - The value to check (Function, Promise, or Thenable).
 * @returns True if the input is an AsyncFunction or a Promise/Thenable, false otherwise.
 * 
 * @example
 * const asyncFn = async () => 1;
 * isAsyncOrPromise(asyncFn); // true
 * 
 * const promise = Promise.resolve(1);
 * isAsyncOrPromise(promise); // true
 * 
 * const syncFn = () => 1;
 * isAsyncOrPromise(syncFn); // false
 */
export function isAsyncOrPromise(input: Function | Promise<unknown> | { then?: unknown }): boolean {
  if (!input) return false;

  if (input instanceof Promise || (typeof input === 'object' && typeof input.then === 'function')) {
    return true;
  }
  
  if (typeof input === 'function') {
     return Object.prototype.toString.call(input) === '[object AsyncFunction]';
  }

  return false;
}