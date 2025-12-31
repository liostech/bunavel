import { describe, test, expect } from "bun:test";
import { optional, value, tap, blank, filled, sleep } from "../../src/core/support/helpers";

describe("Helpers", () => {
  describe("optional()", () => {
    test("should return value if not null/undefined", () => {
      expect(optional("hello")).toBe("hello");
      expect(optional(42)).toBe(42);
      expect(optional(false)).toBe(false);
      expect(optional(0)).toBe(0);
    });

    test("should return undefined for null/undefined", () => {
      expect(optional(null)).toBeUndefined();
      expect(optional(undefined)).toBeUndefined();
    });

    test("should return default value", () => {
      expect(optional(null, "default")).toBe("default");
      expect(optional(undefined, 42)).toBe(42);
    });
  });

  describe("value()", () => {
    test("should return value directly", () => {
      expect(value(42)).toBe(42);
      expect(value("hello")).toBe("hello");
    });

    test("should execute callback and return result", () => {
      expect(value(() => 42)).toBe(42);
      expect(value(() => "hello")).toBe("hello");
    });
  });

  describe("tap()", () => {
    test("should execute callback and return original value", () => {
      let called = false;
      const result = tap(42, (v) => {
        called = true;
        expect(v).toBe(42);
      });
      expect(result).toBe(42);
      expect(called).toBe(true);
    });

    test("should work with objects", () => {
      const obj = { name: "Alice" };
      let capturedValue: any;
      
      const result = tap(obj, (v) => {
        capturedValue = v;
      });
      
      expect(result).toBe(obj);
      expect(capturedValue).toBe(obj);
    });
  });

  describe("blank()", () => {
    test("should return true for blank values", () => {
      expect(blank(null)).toBe(true);
      expect(blank(undefined)).toBe(true);
      expect(blank("")).toBe(true);
      expect(blank("   ")).toBe(true);
      expect(blank([])).toBe(true);
      expect(blank({})).toBe(true);
    });

    test("should return false for filled values", () => {
      expect(blank("hello")).toBe(false);
      expect(blank(0)).toBe(false);
      expect(blank(false)).toBe(false);
      expect(blank([1, 2, 3])).toBe(false);
      expect(blank({ name: "Alice" })).toBe(false);
    });
  });

  describe("filled()", () => {
    test("should return true for filled values", () => {
      expect(filled("hello")).toBe(true);
      expect(filled(0)).toBe(true);
      expect(filled(false)).toBe(true);
      expect(filled([1, 2, 3])).toBe(true);
      expect(filled({ name: "Alice" })).toBe(true);
    });

    test("should return false for blank values", () => {
      expect(filled(null)).toBe(false);
      expect(filled(undefined)).toBe(false);
      expect(filled("")).toBe(false);
      expect(filled("   ")).toBe(false);
      expect(filled([])).toBe(false);
      expect(filled({})).toBe(false);
    });
  });

  describe("sleep()", () => {
    test("should delay execution", async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some margin
    });
  });
});
