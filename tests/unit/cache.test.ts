import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { Cache } from "../../src/core/cache/Cache";
import { MemoryCacheDriver } from "../../src/core/cache/MemoryCacheDriver";
import { FileCacheDriver } from "../../src/core/cache/FileCacheDriver";
import * as fs from "fs";
import * as path from "path";

const testCachePath = "./storage/test-cache";

describe("Cache", () => {
  afterAll(() => {
    // Clean up test cache directory
    if (fs.existsSync(testCachePath)) {
      const files = fs.readdirSync(testCachePath);
      for (const file of files) {
        fs.unlinkSync(path.join(testCachePath, file));
      }
      fs.rmdirSync(testCachePath);
    }
  });

  describe("Memory Cache Driver", () => {
    let cache: Cache;

    beforeEach(() => {
      cache = new Cache({ driver: "memory" });
      cache.flush();
    });

    test("should store and retrieve values", () => {
      cache.put("key1", "value1");
      
      expect(cache.get("key1")).toBe("value1");
    });

    test("should return null for non-existent keys", () => {
      expect(cache.get("nonexistent")).toBeNull();
    });

    test("should return default value for non-existent keys", () => {
      expect(cache.get("nonexistent", "default")).toBe("default");
    });

    test("should check if key exists", () => {
      cache.put("key1", "value1");
      
      expect(cache.has("key1")).toBe(true);
      expect(cache.has("key2")).toBe(false);
    });

    test("should check if key is missing", () => {
      cache.put("key1", "value1");
      
      expect(cache.missing("key1")).toBe(false);
      expect(cache.missing("key2")).toBe(true);
    });

    test("should forget a key", () => {
      cache.put("key1", "value1");
      cache.forget("key1");
      
      expect(cache.has("key1")).toBe(false);
    });

    test("should forget multiple keys", () => {
      cache.put("key1", "value1");
      cache.put("key2", "value2");
      cache.forgetMany(["key1", "key2"]);
      
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
    });

    test("should flush all keys", () => {
      cache.put("key1", "value1");
      cache.put("key2", "value2");
      cache.flush();
      
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
    });

    test("should store values with TTL", () => {
      cache.put("key1", "value1", 1); // 1 second TTL
      
      expect(cache.get("key1")).toBe("value1");
      
      // Wait for expiration (simulate)
      // Note: In real test we'd need to wait, but for now we'll test the logic
    });

    test("should store values forever", () => {
      cache.forever("key1", "value1");
      
      expect(cache.get("key1")).toBe("value1");
    });

    test("should remember value with callback", () => {
      let callCount = 0;
      
      const value1 = cache.remember("key1", 60, () => {
        callCount++;
        return "computed value";
      });
      
      expect(value1).toBe("computed value");
      expect(callCount).toBe(1);
      
      // Second call should use cached value
      const value2 = cache.remember("key1", 60, () => {
        callCount++;
        return "computed value";
      });
      
      expect(value2).toBe("computed value");
      expect(callCount).toBe(1); // Callback not called again
    });

    test("should remember forever with callback", () => {
      let callCount = 0;
      
      const value1 = cache.rememberForever("key1", () => {
        callCount++;
        return "computed value";
      });
      
      expect(value1).toBe("computed value");
      expect(callCount).toBe(1);
      
      // Second call should use cached value
      const value2 = cache.rememberForever("key1", () => {
        callCount++;
        return "computed value";
      });
      
      expect(value2).toBe("computed value");
      expect(callCount).toBe(1);
    });

    test("should pull value and remove from cache", () => {
      cache.put("key1", "value1");
      
      const value = cache.pull("key1");
      
      expect(value).toBe("value1");
      expect(cache.has("key1")).toBe(false);
    });

    test("should add value only if key doesn't exist", () => {
      cache.put("key1", "value1");
      
      const added1 = cache.add("key1", "value2");
      expect(added1).toBe(false);
      expect(cache.get("key1")).toBe("value1");
      
      const added2 = cache.add("key2", "value2");
      expect(added2).toBe(true);
      expect(cache.get("key2")).toBe("value2");
    });

    test("should increment numeric values", () => {
      cache.put("counter", 10);
      
      const value1 = cache.increment("counter");
      expect(value1).toBe(11);
      
      const value2 = cache.increment("counter", 5);
      expect(value2).toBe(16);
    });

    test("should decrement numeric values", () => {
      cache.put("counter", 10);
      
      const value1 = cache.decrement("counter");
      expect(value1).toBe(9);
      
      const value2 = cache.decrement("counter", 5);
      expect(value2).toBe(4);
    });

    test("should handle different data types", () => {
      const obj = { name: "John", age: 30 };
      const arr = [1, 2, 3];
      
      cache.put("object", obj);
      cache.put("array", arr);
      cache.put("number", 42);
      cache.put("boolean", true);
      
      expect(cache.get("object")).toEqual(obj);
      expect(cache.get("array")).toEqual(arr);
      expect(cache.get("number")).toBe(42);
      expect(cache.get("boolean")).toBe(true);
    });

    test("should use prefix for keys", () => {
      const cache1 = new Cache({ driver: "memory", prefix: "app1" });
      const cache2 = new Cache({ driver: "memory", prefix: "app2" });
      
      cache1.put("key", "value1");
      cache2.put("key", "value2");
      
      expect(cache1.get("key")).toBe("value1");
      expect(cache2.get("key")).toBe("value2");
    });
  });

  describe("File Cache Driver", () => {
    let cache: Cache;

    beforeEach(() => {
      cache = new Cache({ driver: "file", path: testCachePath });
      cache.flush();
    });

    test("should store and retrieve values from files", () => {
      cache.put("key1", "value1");
      
      expect(cache.get("key1")).toBe("value1");
    });

    test("should persist values across instances", () => {
      cache.put("key1", "value1");
      
      // Create new cache instance with same path
      const cache2 = new Cache({ driver: "file", path: testCachePath });
      
      expect(cache2.get("key1")).toBe("value1");
    });

    test("should forget a key from file", () => {
      cache.put("key1", "value1");
      cache.forget("key1");
      
      expect(cache.has("key1")).toBe(false);
    });

    test("should flush all files", () => {
      cache.put("key1", "value1");
      cache.put("key2", "value2");
      cache.flush();
      
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
    });

    test("should handle complex data types", () => {
      const data = {
        user: { name: "John", age: 30 },
        posts: [{ id: 1, title: "Post 1" }, { id: 2, title: "Post 2" }],
        active: true,
        count: 42,
      };
      
      cache.put("complex", data);
      
      expect(cache.get("complex")).toEqual(data);
    });

    test("should increment and decrement in files", () => {
      cache.put("counter", 10);
      
      expect(cache.increment("counter")).toBe(11);
      expect(cache.decrement("counter", 2)).toBe(9);
      
      // Verify persistence
      const cache2 = new Cache({ driver: "file", path: testCachePath });
      expect(cache2.get("counter")).toBe(9);
    });
  });

  describe("Cache with TTL", () => {
    test("should expire memory cache after TTL", async () => {
      const cache = new Cache({ driver: "memory" });
      
      // Store with 1 second TTL
      cache.put("key1", "value1", 1);
      
      // Should exist immediately
      expect(cache.get("key1")).toBe("value1");
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired
      expect(cache.get("key1")).toBeNull();
    });

    test("should expire file cache after TTL", async () => {
      const cache = new Cache({ driver: "file", path: testCachePath });
      
      // Store with 1 second TTL
      cache.put("key1", "value1", 1);
      
      // Should exist immediately
      expect(cache.get("key1")).toBe("value1");
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired
      expect(cache.get("key1")).toBeNull();
    });
  });
});
