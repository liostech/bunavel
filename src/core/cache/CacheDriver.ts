/**
 * Cache driver interface
 */
export interface CacheDriver {
  /**
   * Get an item from the cache
   */
  get<T = any>(key: string): T | null;

  /**
   * Store an item in the cache
   */
  put(key: string, value: any, ttl?: number): boolean;

  /**
   * Store an item in the cache forever
   */
  forever(key: string, value: any): boolean;

  /**
   * Check if an item exists in the cache
   */
  has(key: string): boolean;

  /**
   * Remove an item from the cache
   */
  forget(key: string): boolean;

  /**
   * Remove all items from the cache
   */
  flush(): boolean;

  /**
   * Get an item from the cache, or store the default value
   */
  remember<T = any>(key: string, ttl: number, callback: () => T): T;

  /**
   * Get an item from the cache, or store the default value forever
   */
  rememberForever<T = any>(key: string, callback: () => T): T;

  /**
   * Increment the value of an item in the cache
   */
  increment(key: string, value?: number): number;

  /**
   * Decrement the value of an item in the cache
   */
  decrement(key: string, value?: number): number;
}
