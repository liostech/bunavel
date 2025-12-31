/**
 * Laravel-inspired helper functions for Bunavel
 */

/**
 * Dump and die - prints variables and stops execution
 * @param args Variables to dump
 */
export function dd(...args: any[]): never {
  console.log("=== DD (Dump and Die) ===");
  args.forEach((arg, index) => {
    console.log(`\n[${index}]:`, arg);
  });
  console.log("\n=========================");
  process.exit(1);
}

/**
 * Dump variables without stopping execution
 * @param args Variables to dump
 */
export function dump(...args: any[]): void {
  console.log("=== DUMP ===");
  args.forEach((arg, index) => {
    console.log(`\n[${index}]:`, arg);
  });
  console.log("\n============");
}

/**
 * Optional helper - returns value or default
 * @param value Value to check
 * @param defaultValue Default if value is null/undefined
 */
export function optional<T>(value: T | null | undefined, defaultValue?: T): T | undefined {
  return value ?? defaultValue;
}

/**
 * Value helper - returns value or executes callback
 * @param value Value or callback
 */
export function value<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

/**
 * Tap helper - passes value to callback and returns value
 * @param value Value to tap
 * @param callback Callback function
 */
export function tap<T>(value: T, callback: (value: T) => void): T {
  callback(value);
  return value;
}

/**
 * Retry helper - retries callback on failure
 * @param times Number of retries
 * @param callback Callback to retry
 * @param delay Delay between retries in ms
 */
export async function retry<T>(
  times: number,
  callback: () => T | Promise<T>,
  delay: number = 0
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < times; i++) {
    try {
      return await callback();
    } catch (error) {
      lastError = error as Error;
      if (i < times - 1 && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Sleep helper - delays execution
 * @param ms Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Blank helper - checks if value is blank (null, undefined, empty string, empty array, empty object)
 * @param value Value to check
 */
export function blank(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/**
 * Filled helper - opposite of blank
 * @param value Value to check
 */
export function filled(value: any): boolean {
  return !blank(value);
}
