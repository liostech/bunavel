import { describe, test, expect } from "bun:test";
import { Arr } from "../../src/core/support/Arr";

describe("Arr", () => {
  describe("get()", () => {
    test("should get value using dot notation", () => {
      const data = { user: { name: "Alice", age: 25 } };
      expect(Arr.get(data, "user.name")).toBe("Alice");
      expect(Arr.get(data, "user.age")).toBe(25);
    });

    test("should get value from array", () => {
      const data = { users: ["Alice", "Bob", "Charlie"] };
      expect(Arr.get(data, "users.0")).toBe("Alice");
      expect(Arr.get(data, "users.2")).toBe("Charlie");
    });

    test("should return default for missing keys", () => {
      const data = { user: { name: "Alice" } };
      expect(Arr.get(data, "user.email", "default@example.com")).toBe("default@example.com");
      expect(Arr.get(data, "missing.key", "default")).toBe("default");
    });

    test("should handle nested arrays and objects", () => {
      const data = {
        users: [
          { name: "Alice", address: { city: "NYC" } },
          { name: "Bob", address: { city: "LA" } }
        ]
      };
      expect(Arr.get(data, "users.0.address.city")).toBe("NYC");
      expect(Arr.get(data, "users.1.name")).toBe("Bob");
    });
  });

  describe("set()", () => {
    test("should set value using dot notation", () => {
      const data: any = {};
      Arr.set(data, "user.name", "Alice");
      expect(data.user.name).toBe("Alice");
    });

    test("should create nested objects", () => {
      const data: any = {};
      Arr.set(data, "user.address.city", "NYC");
      expect(data.user.address.city).toBe("NYC");
    });

    test("should create arrays for numeric keys", () => {
      const data: any = {};
      Arr.set(data, "users.0", "Alice");
      Arr.set(data, "users.1", "Bob");
      expect(data.users[0]).toBe("Alice");
      expect(data.users[1]).toBe("Bob");
    });

    test("should overwrite existing values", () => {
      const data = { user: { name: "Alice" } };
      Arr.set(data, "user.name", "Bob");
      expect(data.user.name).toBe("Bob");
    });
  });

  describe("has()", () => {
    test("should check if key exists", () => {
      const data = { user: { name: "Alice", age: 25 } };
      expect(Arr.has(data, "user.name")).toBe(true);
      expect(Arr.has(data, "user.email")).toBe(false);
    });

    test("should work with arrays", () => {
      const data = { users: ["Alice", "Bob"] };
      expect(Arr.has(data, "users.0")).toBe(true);
      expect(Arr.has(data, "users.5")).toBe(false);
    });
  });

  describe("forget()", () => {
    test("should remove key from object", () => {
      const data = { user: { name: "Alice", age: 25 } };
      Arr.forget(data, "user.age");
      expect(data.user.age).toBeUndefined();
      expect(data.user.name).toBe("Alice");
    });

    test("should remove multiple keys", () => {
      const data = { user: { name: "Alice", age: 25, email: "alice@example.com" } };
      Arr.forget(data, ["user.age", "user.email"]);
      expect(data.user.age).toBeUndefined();
      expect(data.user.email).toBeUndefined();
      expect(data.user.name).toBe("Alice");
    });

    test("should remove array items", () => {
      const data = { users: ["Alice", "Bob", "Charlie"] };
      Arr.forget(data, "users.1");
      expect(data.users).toEqual(["Alice", "Charlie"]);
    });
  });

  describe("flatten()", () => {
    test("should flatten nested arrays", () => {
      expect(Arr.flatten([1, [2, 3], [4, [5, 6]]])).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test("should respect depth parameter", () => {
      expect(Arr.flatten([1, [2, [3, [4]]]], 1)).toEqual([1, 2, [3, [4]]]);
      expect(Arr.flatten([1, [2, [3, [4]]]], 2)).toEqual([1, 2, 3, [4]]);
    });
  });

  describe("divide()", () => {
    test("should divide array into keys and values", () => {
      const [keys, values] = Arr.divide(["a", "b", "c"]);
      expect(keys).toEqual([0, 1, 2]);
      expect(values).toEqual(["a", "b", "c"]);
    });
  });

  describe("except()", () => {
    test("should exclude specified keys", () => {
      const data = { name: "Alice", age: 25, email: "alice@example.com" };
      const result = Arr.except(data, ["age", "email"]);
      expect(result).toEqual({ name: "Alice" });
    });
  });

  describe("only()", () => {
    test("should include only specified keys", () => {
      const data = { name: "Alice", age: 25, email: "alice@example.com" };
      const result = Arr.only(data, ["name", "email"]);
      expect(result).toEqual({ name: "Alice", email: "alice@example.com" });
    });
  });

  describe("pluck()", () => {
    test("should pluck values from array of objects", () => {
      const users = [
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
        { name: "Charlie", age: 35 }
      ];
      expect(Arr.pluck(users, "name")).toEqual(["Alice", "Bob", "Charlie"]);
      expect(Arr.pluck(users, "age")).toEqual([25, 30, 35]);
    });

    test("should pluck with key parameter", () => {
      const users = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" }
      ];
      const result = Arr.pluck(users, "name", "id");
      expect(result).toEqual({ 1: "Alice", 2: "Bob" });
    });
  });

  describe("wrap()", () => {
    test("should wrap non-arrays in array", () => {
      expect(Arr.wrap("hello")).toEqual(["hello"]);
      expect(Arr.wrap(42)).toEqual([42]);
    });

    test("should return arrays unchanged", () => {
      expect(Arr.wrap([1, 2, 3])).toEqual([1, 2, 3]);
    });

    test("should return empty array for null/undefined", () => {
      expect(Arr.wrap(null)).toEqual([]);
      expect(Arr.wrap(undefined)).toEqual([]);
    });
  });

  describe("first()", () => {
    test("should return first element", () => {
      expect(Arr.first([1, 2, 3])).toBe(1);
      expect(Arr.first(["a", "b", "c"])).toBe("a");
    });

    test("should return default for empty array", () => {
      expect(Arr.first([], "default")).toBe("default");
    });
  });

  describe("last()", () => {
    test("should return last element", () => {
      expect(Arr.last([1, 2, 3])).toBe(3);
      expect(Arr.last(["a", "b", "c"])).toBe("c");
    });

    test("should return default for empty array", () => {
      expect(Arr.last([], "default")).toBe("default");
    });
  });

  describe("shuffle()", () => {
    test("should shuffle array elements", () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = Arr.shuffle(arr);
      
      expect(shuffled).toHaveLength(5);
      expect(shuffled).toContain(1);
      expect(shuffled).toContain(5);
      // Original array should be unchanged
      expect(arr).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("random()", () => {
    test("should return random element", () => {
      const arr = [1, 2, 3, 4, 5];
      const random = Arr.random(arr);
      expect(arr).toContain(random as number);
    });

    test("should return random elements with count", () => {
      const arr = [1, 2, 3, 4, 5];
      const random = Arr.random(arr, 3);
      expect(Array.isArray(random)).toBe(true);
      expect(random).toHaveLength(3);
      (random as number[]).forEach(item => {
        expect(arr).toContain(item);
      });
    });

    test("should return undefined for empty array", () => {
      expect(Arr.random([])).toBeUndefined();
    });
  });
});
