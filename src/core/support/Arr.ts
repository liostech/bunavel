/**
 * Array helper functions inspired by Laravel's Arr class
 */
export class Arr {
  /**
   * Get an item from an array using dot notation
   * @param array Array to search
   * @param key Dot-notation key (e.g., "user.address.city")
   * @param defaultValue Default value if not found
   */
  static get(array: any, key: string, defaultValue?: any): any {
    if (key === null || key === "") return array;

    const keys = key.split(".");
    let result = array;

    for (const segment of keys) {
      if (result === null || result === undefined || typeof result !== "object") {
        return defaultValue;
      }

      if (Array.isArray(result)) {
        const index = parseInt(segment, 10);
        if (isNaN(index) || index < 0 || index >= result.length) {
          return defaultValue;
        }
        result = result[index];
      } else {
        if (!(segment in result)) {
          return defaultValue;
        }
        result = result[segment];
      }
    }

    return result ?? defaultValue;
  }

  /**
   * Set an item in an array using dot notation
   * @param array Array to modify
   * @param key Dot-notation key
   * @param value Value to set
   */
  static set(array: any, key: string, value: any): any {
    if (key === null || key === "") return array;

    const keys = key.split(".");
    let current = array;

    for (let i = 0; i < keys.length - 1; i++) {
      const segment = keys[i]!;

      if (!(segment in current) || typeof current[segment] !== "object") {
        // Determine if next segment is an array index
        const nextSegment = keys[i + 1]!;
        const isArrayIndex = /^\d+$/.test(nextSegment);
        current[segment] = isArrayIndex ? [] : {};
      }

      current = current[segment];
    }

    const lastKey = keys[keys.length - 1]!;
    current[lastKey] = value;
    return array;
  }

  /**
   * Check if an item exists in an array using dot notation
   * @param array Array to check
   * @param key Dot-notation key
   */
  static has(array: any, key: string): boolean {
    if (key === null || key === "") return false;

    const keys = key.split(".");
    let current = array;

    for (const segment of keys) {
      if (current === null || current === undefined || typeof current !== "object") {
        return false;
      }

      if (Array.isArray(current)) {
        const index = parseInt(segment, 10);
        if (isNaN(index) || index < 0 || index >= current.length) {
          return false;
        }
        current = current[index];
      } else {
        if (!(segment in current)) {
          return false;
        }
        current = current[segment];
      }
    }

    return true;
  }

  /**
   * Remove one or many items from an array using dot notation
   * @param array Array to modify
   * @param keys Keys to remove
   */
  static forget(array: any, keys: string | string[]): any {
    const keysArray = Array.isArray(keys) ? keys : [keys];

    for (const key of keysArray) {
      if (key === null || key === "") continue;

      const segments = key.split(".");
      let current = array;

      for (let i = 0; i < segments.length - 1; i++) {
        const segment = segments[i]!;

        if (!(segment in current) || typeof current[segment] !== "object") {
          continue;
        }

        current = current[segment];
      }

      const lastSegment = segments[segments.length - 1]!;
      if (Array.isArray(current)) {
        const index = parseInt(lastSegment, 10);
        if (!isNaN(index) && index >= 0 && index < current.length) {
          current.splice(index, 1);
        }
      } else {
        delete current[lastSegment];
      }
    }

    return array;
  }

  /**
   * Flatten a multi-dimensional array
   * @param array Array to flatten
   * @param depth Depth to flatten (Infinity for complete flatten)
   */
  static flatten(array: any[], depth: number = Infinity): any[] {
    const result: any[] = [];

    const flattenHelper = (arr: any[], currentDepth: number) => {
      for (const item of arr) {
        if (Array.isArray(item) && currentDepth > 0) {
          flattenHelper(item, currentDepth - 1);
        } else {
          result.push(item);
        }
      }
    };

    flattenHelper(array, depth);
    return result;
  }

  /**
   * Divide array into keys and values
   * @param array Array to divide
   */
  static divide<T>(array: T[]): [number[], T[]] {
    const keys = array.map((_, index) => index);
    const values = [...array];
    return [keys, values];
  }

  /**
   * Get all items except those with specified keys
   * @param array Object/array to filter
   * @param keys Keys to exclude
   */
  static except<T extends object>(array: T, keys: string[]): Partial<T> {
    const result: any = Array.isArray(array) ? [...array] : { ...array };

    for (const key of keys) {
      if (key in result) {
        delete result[key];
      }
    }

    return result;
  }

  /**
   * Get only items with specified keys
   * @param array Object/array to filter
   * @param keys Keys to include
   */
  static only<T extends object>(array: T, keys: string[]): Partial<T> {
    const result: any = {};

    for (const key of keys) {
      if (key in array) {
        result[key] = (array as any)[key];
      }
    }

    return result;
  }

  /**
   * Pluck values from an array of objects
   * @param array Array of objects
   * @param value Key to pluck
   * @param key Optional key to use as array keys
   */
  static pluck<T extends object>(array: T[], value: string, key?: string): any[] | Record<string, any> {
    if (key) {
      const result: Record<string, any> = {};
      for (const item of array) {
        const keyValue = this.get(item, key);
        const pluckValue = this.get(item, value);
        if (keyValue !== undefined) {
          result[keyValue] = pluckValue;
        }
      }
      return result;
    }

    return array.map(item => this.get(item, value));
  }

  /**
   * Wrap value in array if it's not already an array
   * @param value Value to wrap
   */
  static wrap<T>(value: T | T[]): T[] {
    if (value === null || value === undefined) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  }

  /**
   * Get first element of array
   * @param array Array
   * @param defaultValue Default value
   */
  static first<T>(array: T[], defaultValue?: T): T | undefined {
    return array.length > 0 ? array[0] : defaultValue;
  }

  /**
   * Get last element of array
   * @param array Array
   * @param defaultValue Default value
   */
  static last<T>(array: T[], defaultValue?: T): T | undefined {
    return array.length > 0 ? array[array.length - 1] : defaultValue;
  }

  /**
   * Shuffle an array randomly
   * @param array Array to shuffle
   */
  static shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = result[i]!;
      result[i] = result[j]!;
      result[j] = temp;
    }
    return result;
  }

  /**
   * Get random element(s) from array
   * @param array Array
   * @param count Number of elements to get
   */
  static random<T>(array: T[], count?: number): T | T[] | undefined {
    if (count === undefined) {
      if (array.length === 0) return undefined;
      return array[Math.floor(Math.random() * array.length)];
    }

    const shuffled = this.shuffle(array);
    return shuffled.slice(0, Math.min(count, array.length));
  }
}
