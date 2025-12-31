import type { CacheDriver } from "./CacheDriver";
import { MemoryCacheDriver } from "./MemoryCacheDriver";
import { FileCacheDriver } from "./FileCacheDriver";

export type CacheDriverType = "memory" | "file";

export interface CacheConfig {
  driver: CacheDriverType;
  prefix?: string;
  
  // File driver options
  path?: string;
}

/**
 * Cache manager
 * Provides a unified interface to different cache drivers
 */
export class Cache {
  private driver: CacheDriver;
  private prefix: string;

  constructor(config: CacheConfig) {
    this.prefix = config.prefix || "";
    
    // Create driver based on config
    switch (config.driver) {
      case "memory":
        this.driver = new MemoryCacheDriver();
        break;
      case "file":
        this.driver = new FileCacheDriver(config.path);
        break;
      default:
        throw new Error(`Unsupported cache driver: ${config.driver}`);
    }
  }

  /**
   * Get the prefixed key
   */
  private getPrefixedKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }

  /**
   * Get an item from the cache
   */
  get<T = any>(key: string, defaultValue?: T): T | null {
    const value = this.driver.get<T>(this.getPrefixedKey(key));
    return value !== null ? value : (defaultValue ?? null);
  }

  /**
   * Store an item in the cache
   */
  put(key: string, value: any, ttl?: number): boolean {
    return this.driver.put(this.getPrefixedKey(key), value, ttl);
  }

  /**
   * Store an item in the cache for a given number of seconds
   */
  putFor(key: string, value: any, seconds: number): boolean {
    return this.put(key, value, seconds);
  }

  /**
   * Store an item in the cache forever
   */
  forever(key: string, value: any): boolean {
    return this.driver.forever(this.getPrefixedKey(key), value);
  }

  /**
   * Check if an item exists in the cache
   */
  has(key: string): boolean {
    return this.driver.has(this.getPrefixedKey(key));
  }

  /**
   * Check if an item does not exist in the cache
   */
  missing(key: string): boolean {
    return !this.has(key);
  }

  /**
   * Remove an item from the cache
   */
  forget(key: string): boolean {
    return this.driver.forget(this.getPrefixedKey(key));
  }

  /**
   * Remove multiple items from the cache
   */
  forgetMany(keys: string[]): boolean {
    let success = true;
    for (const key of keys) {
      success = this.forget(key) && success;
    }
    return success;
  }

  /**
   * Remove all items from the cache
   */
  flush(): boolean {
    return this.driver.flush();
  }

  /**
   * Get an item from the cache, or execute the given callback and store the result
   */
  remember<T = any>(key: string, ttl: number, callback: () => T): T {
    return this.driver.remember<T>(this.getPrefixedKey(key), ttl, callback);
  }

  /**
   * Get an item from the cache, or execute the given callback and store the result forever
   */
  rememberForever<T = any>(key: string, callback: () => T): T {
    return this.driver.rememberForever<T>(this.getPrefixedKey(key), callback);
  }

  /**
   * Get and delete an item from the cache
   */
  pull<T = any>(key: string, defaultValue?: T): T | null {
    const value = this.get<T>(key, defaultValue);
    this.forget(key);
    return value;
  }

  /**
   * Store an item in the cache if the key doesn't exist
   */
  add(key: string, value: any, ttl?: number): boolean {
    if (this.has(key)) {
      return false;
    }
    return this.put(key, value, ttl);
  }

  /**
   * Increment the value of an item in the cache
   */
  increment(key: string, value: number = 1): number {
    return this.driver.increment(this.getPrefixedKey(key), value);
  }

  /**
   * Decrement the value of an item in the cache
   */
  decrement(key: string, value: number = 1): number {
    return this.driver.decrement(this.getPrefixedKey(key), value);
  }

  /**
   * Get the underlying cache driver
   */
  getDriver(): CacheDriver {
    return this.driver;
  }
}
