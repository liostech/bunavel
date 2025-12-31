import type { CacheDriver } from "./CacheDriver";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

interface CacheItem {
  value: any;
  expiresAt: number | null;
}

/**
 * File cache driver
 * Stores cache items in files on disk
 */
export class FileCacheDriver implements CacheDriver {
  private cachePath: string;

  constructor(cachePath: string = "./storage/cache") {
    this.cachePath = cachePath;
    
    // Ensure cache directory exists
    if (!fs.existsSync(this.cachePath)) {
      fs.mkdirSync(this.cachePath, { recursive: true });
    }
  }

  /**
   * Get the file path for a cache key
   */
  private getFilePath(key: string): string {
    const hash = crypto.createHash("md5").update(key).digest("hex");
    return path.join(this.cachePath, hash);
  }

  /**
   * Read cache item from file
   */
  private readItem(filePath: string): CacheItem | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content) as CacheItem;
    } catch {
      return null;
    }
  }

  /**
   * Write cache item to file
   */
  private writeItem(filePath: string, item: CacheItem): boolean {
    try {
      fs.writeFileSync(filePath, JSON.stringify(item), "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get an item from the cache
   */
  get<T = any>(key: string): T | null {
    const filePath = this.getFilePath(key);
    const item = this.readItem(filePath);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (item.expiresAt !== null && item.expiresAt < Date.now()) {
      fs.unlinkSync(filePath);
      return null;
    }

    return item.value as T;
  }

  /**
   * Store an item in the cache
   */
  put(key: string, value: any, ttl?: number): boolean {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
    const filePath = this.getFilePath(key);
    
    return this.writeItem(filePath, {
      value,
      expiresAt,
    });
  }

  /**
   * Store an item in the cache forever
   */
  forever(key: string, value: any): boolean {
    const filePath = this.getFilePath(key);
    
    return this.writeItem(filePath, {
      value,
      expiresAt: null,
    });
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
    const filePath = this.getFilePath(key);
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Remove all items from the cache
   */
  flush(): boolean {
    try {
      const files = fs.readdirSync(this.cachePath);
      
      for (const file of files) {
        fs.unlinkSync(path.join(this.cachePath, file));
      }
      
      return true;
    } catch {
      return false;
    }
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
    const filePath = this.getFilePath(key);
    const item = this.readItem(filePath);
    const expiresAt = item?.expiresAt || null;
    
    this.writeItem(filePath, {
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
