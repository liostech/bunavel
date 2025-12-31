/**
 * Collection class inspired by Laravel Collections
 * Provides fluent, chainable methods for working with arrays
 */
export class Collection<T = any> {
  protected items: T[];

  constructor(items: T[] = []) {
    this.items = items;
  }

  /**
   * Get all items in the collection
   */
  public all(): T[] {
    return this.items;
  }

  /**
   * Get the average value of a given key
   */
  public avg(key?: keyof T | ((item: T) => number)): number {
    if (this.isEmpty()) {
      return 0;
    }

    const sum = this.sum(key);
    return sum / this.count();
  }

  /**
   * Chunk the collection into smaller collections
   */
  public chunk(size: number): Collection<T[]> {
    const chunks: T[][] = [];
    for (let i = 0; i < this.items.length; i += size) {
      chunks.push(this.items.slice(i, i + size));
    }
    return new Collection(chunks);
  }

  /**
   * Collapse a collection of arrays into a single flat collection
   */
  public collapse(): Collection<any> {
    const collapsed: any[] = [];
    for (const item of this.items) {
      if (Array.isArray(item)) {
        collapsed.push(...item);
      } else {
        collapsed.push(item);
      }
    }
    return new Collection(collapsed);
  }

  /**
   * Determine if an item exists in the collection
   */
  public contains(value: T | ((item: T) => boolean)): boolean {
    if (typeof value === "function") {
      return this.items.some(value as (item: T) => boolean);
    }
    return this.items.includes(value);
  }

  /**
   * Count the number of items in the collection
   */
  public count(): number {
    return this.items.length;
  }

  /**
   * Get the items that are not present in the given items
   */
  public diff(items: T[]): Collection<T> {
    return new Collection(
      this.items.filter(item => !items.includes(item))
    );
  }

  /**
   * Execute a callback over each item
   */
  public each(callback: (item: T, index: number) => void | boolean): this {
    for (let i = 0; i < this.items.length; i++) {
      const result = callback(this.items[i]!, i);
      if (result === false) {
        break;
      }
    }
    return this;
  }

  /**
   * Determine if the collection is empty
   */
  public isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Determine if the collection is not empty
   */
  public isNotEmpty(): boolean {
    return !this.isEmpty();
  }

  /**
   * Filter items by the given callback
   */
  public filter(callback: (item: T, index: number) => boolean): Collection<T> {
    return new Collection(this.items.filter(callback));
  }

  /**
   * Get the first item, or first item that passes truth test
   */
  public first(callback?: (item: T) => boolean, defaultValue?: T): T | undefined {
    if (callback) {
      return this.items.find(callback) ?? defaultValue;
    }
    return this.items[0] ?? defaultValue;
  }

  /**
   * Map a collection and flatten the result by a single level
   */
  public flatMap<U>(callback: (item: T) => U[]): Collection<U> {
    const mapped = this.items.map(callback);
    return new Collection(mapped).collapse();
  }

  /**
   * Flatten a multi-dimensional collection
   */
  public flatten(depth: number = Infinity): Collection<any> {
    const flatten = (arr: any[], d: number): any[] => {
      return d > 0
        ? arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val, d - 1) : val), [])
        : arr.slice();
    };
    return new Collection(flatten(this.items, depth));
  }

  /**
   * Get an item by key
   */
  public get(index: number, defaultValue?: T): T | undefined {
    return this.items[index] ?? defaultValue;
  }

  /**
   * Group items by a given key
   */
  public groupBy<K extends keyof T>(key: K): Map<T[K], T[]> {
    const groups = new Map<T[K], T[]>();
    for (const item of this.items) {
      const groupKey = item[key];
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    }
    return groups;
  }

  /**
   * Determine if a given key exists
   */
  public has(index: number): boolean {
    return index >= 0 && index < this.items.length;
  }

  /**
   * Concatenate values of a given key as a string
   */
  public implode(glue: string, key?: keyof T): string {
    if (key) {
      return this.pluck(key).toArray().join(glue);
    }
    return this.items.join(glue);
  }

  /**
   * Get the last item, or last item that passes truth test
   */
  public last(callback?: (item: T) => boolean, defaultValue?: T): T | undefined {
    if (callback) {
      const filtered = this.items.filter(callback);
      return filtered[filtered.length - 1] ?? defaultValue;
    }
    return this.items[this.items.length - 1] ?? defaultValue;
  }

  /**
   * Run a map over each item
   */
  public map<U>(callback: (item: T, index: number) => U): Collection<U> {
    return new Collection(this.items.map(callback));
  }

  /**
   * Get the max value of a given key
   */
  public max(key?: keyof T | ((item: T) => number)): number {
    if (this.isEmpty()) {
      return -Infinity;
    }

    if (!key) {
      return Math.max(...(this.items as any));
    }

    if (typeof key === "function") {
      return Math.max(...this.items.map(key));
    }

    return Math.max(...this.items.map(item => item[key] as any));
  }

  /**
   * Get the min value of a given key
   */
  public min(key?: keyof T | ((item: T) => number)): number {
    if (this.isEmpty()) {
      return Infinity;
    }

    if (!key) {
      return Math.min(...(this.items as any));
    }

    if (typeof key === "function") {
      return Math.min(...this.items.map(key));
    }

    return Math.min(...this.items.map(item => item[key] as any));
  }

  /**
   * Get the nth item
   */
  public nth(n: number, offset: number = 0): Collection<T> {
    const result: T[] = [];
    for (let i = offset; i < this.items.length; i += n) {
      result.push(this.items[i]!);
    }
    return new Collection(result);
  }

  /**
   * Get the items with the specified keys
   */
  public only(...keys: (keyof T)[]): Collection<Partial<T>> {
    return this.map(item => {
      const result: any = {};
      for (const key of keys) {
        if (item && typeof item === 'object' && key in item) {
          result[key] = item[key];
        }
      }
      return result;
    });
  }

  /**
   * Get the values of a given key
   */
  public pluck<K extends keyof T>(key: K): Collection<T[K]> {
    return new Collection(this.items.map(item => item[key]));
  }

  /**
   * Push an item onto the end of the collection
   */
  public push(...items: T[]): this {
    this.items.push(...items);
    return this;
  }

  /**
   * Reduce the collection to a single value
   */
  public reduce<U>(callback: (carry: U, item: T) => U, initial: U): U {
    return this.items.reduce(callback, initial);
  }

  /**
   * Filter items where the given key is not null
   */
  public whereNotNull<K extends keyof T>(key: K): Collection<T> {
    return this.filter(item => item[key] !== null && item[key] !== undefined);
  }

  /**
   * Reverse items order
   */
  public reverse(): Collection<T> {
    return new Collection([...this.items].reverse());
  }

  /**
   * Skip the first {count} items
   */
  public skip(count: number): Collection<T> {
    return new Collection(this.items.slice(count));
  }

  /**
   * Get a slice of items
   */
  public slice(start: number, end?: number): Collection<T> {
    return new Collection(this.items.slice(start, end));
  }

  /**
   * Sort items
   */
  public sort(compareFn?: (a: T, b: T) => number): Collection<T> {
    return new Collection([...this.items].sort(compareFn));
  }

  /**
   * Sort items by a key
   */
  public sortBy<K extends keyof T>(key: K, descending: boolean = false): Collection<T> {
    return new Collection([...this.items].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      
      if (aVal < bVal) return descending ? 1 : -1;
      if (aVal > bVal) return descending ? -1 : 1;
      return 0;
    }));
  }

  /**
   * Sort items in descending order
   */
  public sortDesc(): Collection<T> {
    return this.sort((a, b) => {
      if (a < b) return 1;
      if (a > b) return -1;
      return 0;
    });
  }

  /**
   * Sort items by a key in descending order
   */
  public sortByDesc<K extends keyof T>(key: K): Collection<T> {
    return this.sortBy(key, true);
  }

  /**
   * Get the sum of the given values
   */
  public sum(key?: keyof T | ((item: T) => number)): number {
    if (!key) {
      return (this.items as any).reduce((sum: number, item: any) => sum + item, 0);
    }

    if (typeof key === "function") {
      return this.items.reduce((sum, item) => sum + key(item), 0);
    }

    return this.items.reduce((sum, item) => sum + (item[key] as any), 0);
  }

  /**
   * Take the first or last {limit} items
   */
  public take(limit: number): Collection<T> {
    if (limit < 0) {
      return new Collection(this.items.slice(limit));
    }
    return new Collection(this.items.slice(0, limit));
  }

  /**
   * Pass the collection to the given callback and return the result
   */
  public pipe<U>(callback: (collection: Collection<T>) => U): U {
    return callback(this);
  }

  /**
   * Pass the collection to the given callback and then return it
   */
  public tap(callback: (collection: Collection<T>) => void): this {
    callback(this);
    return this;
  }

  /**
   * Get the collection as an array
   */
  public toArray(): T[] {
    return [...this.items];
  }

  /**
   * Get the collection as JSON
   */
  public toJson(): string {
    return JSON.stringify(this.items);
  }

  /**
   * Get unique items
   */
  public unique<K extends keyof T>(key?: K): Collection<T> {
    if (!key) {
      return new Collection([...new Set(this.items)]);
    }

    const seen = new Set();
    const unique: T[] = [];
    
    for (const item of this.items) {
      const value = item[key];
      if (!seen.has(value)) {
        seen.add(value);
        unique.push(item);
      }
    }
    
    return new Collection(unique);
  }

  /**
   * Reset the keys on the underlying array
   */
  public values(): Collection<T> {
    return new Collection([...this.items]);
  }

  /**
   * Filter items by a given key value pair
   */
  public where<K extends keyof T>(key: K, value: T[K]): Collection<T>;
  public where<K extends keyof T>(key: K, operator: string, value: any): Collection<T>;
  public where<K extends keyof T>(key: K, operatorOrValue: any, value?: any): Collection<T> {
    if (value === undefined) {
      // Simple equality
      return this.filter(item => item[key] === operatorOrValue);
    }

    // With operator
    const operator = operatorOrValue;
    return this.filter(item => {
      const itemValue = item[key];
      switch (operator) {
        case "=":
        case "==":
          return itemValue == value;
        case "===":
          return itemValue === value;
        case "!=":
        case "<>":
          return itemValue != value;
        case "!==":
          return itemValue !== value;
        case ">":
          return (itemValue as any) > value;
        case ">=":
          return (itemValue as any) >= value;
        case "<":
          return (itemValue as any) < value;
        case "<=":
          return (itemValue as any) <= value;
        default:
          return false;
      }
    });
  }

  /**
   * Filter items where key is in given array
   */
  public whereIn<K extends keyof T>(key: K, values: T[K][]): Collection<T> {
    return this.filter(item => values.includes(item[key]));
  }

  /**
   * Filter items where key is not in given array
   */
  public whereNotIn<K extends keyof T>(key: K, values: T[K][]): Collection<T> {
    return this.filter(item => !values.includes(item[key]));
  }

  /**
   * Zip the collection with one or more arrays
   */
  public zip<U>(...arrays: U[][]): Collection<(T | U)[]> {
    const result: (T | U)[][] = [];
    const maxLength = Math.max(this.items.length, ...arrays.map(arr => arr.length));

    for (let i = 0; i < maxLength; i++) {
      const row: (T | U)[] = [this.items[i]!];
      for (const arr of arrays) {
        row.push(arr[i]!);
      }
      result.push(row);
    }

    return new Collection(result);
  }

  /**
   * Make the collection iterable
   */
  *[Symbol.iterator](): Iterator<T> {
    for (const item of this.items) {
      yield item;
    }
  }
}

/**
 * Create a new collection instance
 */
export function collect<T>(items: T[] = []): Collection<T> {
  return new Collection(items);
}
