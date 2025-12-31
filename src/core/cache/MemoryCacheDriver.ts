import type { CacheDriver } from "./CacheDriver";

interface CacheItem {
  value: any;
  expiresAt: number | null;
}

/**
 * Memory cache driver
 * Stores cache items in memory (lost on restart)
 */
export class MemoryCacheDriver implements CacheDriver {
  private store: Map<string, CacheItem> = new Map();

  /**
   * Get an item from the cache
   */
  get<T = any>(key: string): T | null {
    const item = this.store.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (item.expiresAt !== null && item.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return item.value as T;
  }

  /**
   * Store an item in the cache
   */
  put(key: string, value: any, ttl?: number): boolean {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
    
    this.store.set(key, {
      value,
      expiresAt,
    });

    return true;
  }

  /**
   * Store an item in the cache forever
   */
  forever(key: string, value: any): boolean {
    this.store.set(key, {
      value,
      expiresAt: null,
    });

    return true;
  }

  /**
   * Check if an item exists in the cache
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Remove an item from the cache
   */
  forget(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Remove all items from the cache
   */
  flush(): boolean {
    this.store.clear();
    return true;
  }

  /**
   * Get an item from the cache, or store the default value
   */
  remember<T = any>(key: string, ttl: number, callback: () => T): T {
    const cached = this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const value = callback();
    this.put(key, value, ttl);
    
    return value;
  }

  /**
   * Get an item from the cache, or store the default value forever
   */
  rememberForever<T = any>(key: string, callback: () => T): T {
    const cached = this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const value = callback();
    this.forever(key, value);
    
    return value;
  }

  /**
   * Increment the value of an item in the cache
   */
  increment(key: string, value: number = 1): number {
    const current = this.get<number>(key) || 0;
    const newValue = current + value;
    
    // Preserve TTL when incrementing
    const item = this.store.get(key);
    const expiresAt = item?.expiresAt || null;
    
    this.store.set(key, {
      value: newValue,
      expiresAt,
    });

    return newValue;
  }

  /**
   * Decrement the value of an item in the cache
   */
  decrement(key: string, value: number = 1): number {
    return this.increment(key, -value);
  }
}
