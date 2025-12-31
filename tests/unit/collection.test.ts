import { describe, test, expect } from "bun:test";
import { Collection, collect } from "../../src/core/support/Collection";

describe("Collection", () => {
  describe("Creation", () => {
    test("should create empty collection", () => {
      const collection = collect();
      expect(collection.count()).toBe(0);
      expect(collection.isEmpty()).toBe(true);
    });

    test("should create collection from array", () => {
      const collection = collect([1, 2, 3]);
      expect(collection.count()).toBe(3);
      expect(collection.toArray()).toEqual([1, 2, 3]);
    });

    test("should create collection with new", () => {
      const collection = new Collection([1, 2, 3]);
      expect(collection.count()).toBe(3);
    });
  });

  describe("Basic Operations", () => {
    test("all() should return all items", () => {
      const items = [1, 2, 3];
      const collection = collect(items);
      expect(collection.all()).toEqual(items);
    });

    test("count() should return item count", () => {
      expect(collect([1, 2, 3]).count()).toBe(3);
      expect(collect([]).count()).toBe(0);
    });

    test("isEmpty() should check if empty", () => {
      expect(collect([]).isEmpty()).toBe(true);
      expect(collect([1]).isEmpty()).toBe(false);
    });

    test("isNotEmpty() should check if not empty", () => {
      expect(collect([]).isNotEmpty()).toBe(false);
      expect(collect([1]).isNotEmpty()).toBe(true);
    });
  });

  describe("Array Methods", () => {
    test("map() should transform items", () => {
      const collection = collect([1, 2, 3]);
      const result = collection.map(n => n * 2);
      expect(result.toArray()).toEqual([2, 4, 6]);
    });

    test("filter() should filter items", () => {
      const collection = collect([1, 2, 3, 4, 5]);
      const result = collection.filter(n => n > 2);
      expect(result.toArray()).toEqual([3, 4, 5]);
    });

    test("reduce() should reduce to single value", () => {
      const collection = collect([1, 2, 3, 4]);
      const sum = collection.reduce((acc, n) => acc + n, 0);
      expect(sum).toBe(10);
    });

    test("each() should iterate over items", () => {
      const items: number[] = [];
      collect([1, 2, 3]).each(n => { items.push(n); });
      expect(items).toEqual([1, 2, 3]);
    });

    test("each() should break when callback returns false", () => {
      const items: number[] = [];
      collect([1, 2, 3, 4]).each(n => {
        if (n === 3) return false;
        items.push(n);
      });
      expect(items).toEqual([1, 2]);
    });
  });

  describe("Retrieval", () => {
    test("first() should get first item", () => {
      expect(collect([1, 2, 3]).first()).toBe(1);
      expect(collect([]).first()).toBeUndefined();
    });

    test("first() with callback should get first matching", () => {
      const result = collect([1, 2, 3, 4]).first(n => n > 2);
      expect(result).toBe(3);
    });

    test("last() should get last item", () => {
      expect(collect([1, 2, 3]).last()).toBe(3);
      expect(collect([]).last()).toBeUndefined();
    });

    test("get() should get item by index", () => {
      const collection = collect(["a", "b", "c"]);
      expect(collection.get(1)).toBe("b");
      expect(collection.get(10)).toBeUndefined();
    });

    test("nth() should get every nth item", () => {
      const result = collect([1, 2, 3, 4, 5, 6]).nth(2);
      expect(result.toArray()).toEqual([1, 3, 5]);
    });
  });

  describe("Transformation", () => {
    test("chunk() should split into chunks", () => {
      const result = collect([1, 2, 3, 4, 5]).chunk(2);
      expect(result.toArray()).toEqual([[1, 2], [3, 4], [5]]);
    });

    test("pluck() should extract values", () => {
      const collection = collect([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ]);
      expect(collection.pluck("name").toArray()).toEqual(["Alice", "Bob"]);
    });

    test("flatten() should flatten array", () => {
      const result = collect([[1, 2], [3, 4], [5]]).flatten();
      expect(result.toArray()).toEqual([1, 2, 3, 4, 5]);
    });

    test("collapse() should collapse arrays", () => {
      const result = collect([[1, 2], [3, 4]]).collapse();
      expect(result.toArray()).toEqual([1, 2, 3, 4]);
    });
  });

  describe("Aggregation", () => {
    test("sum() should sum values", () => {
      expect(collect([1, 2, 3, 4]).sum()).toBe(10);
    });

    test("sum() with key should sum object values", () => {
      const collection = collect([
        { price: 10 },
        { price: 20 },
        { price: 30 },
      ]);
      expect(collection.sum("price")).toBe(60);
    });

    test("avg() should calculate average", () => {
      expect(collect([1, 2, 3, 4]).avg()).toBe(2.5);
    });

    test("min() should get minimum value", () => {
      expect(collect([3, 1, 4, 1, 5]).min()).toBe(1);
    });

    test("max() should get maximum value", () => {
      expect(collect([3, 1, 4, 1, 5]).max()).toBe(5);
    });
  });

  describe("Sorting", () => {
    test("sort() should sort items", () => {
      const result = collect([3, 1, 4, 1, 5]).sort();
      expect(result.toArray()).toEqual([1, 1, 3, 4, 5]);
    });

    test("sortDesc() should sort descending", () => {
      const result = collect([3, 1, 4, 1, 5]).sortDesc();
      expect(result.toArray()).toEqual([5, 4, 3, 1, 1]);
    });

    test("sortBy() should sort by key", () => {
      const collection = collect([
        { name: "Charlie", age: 30 },
        { name: "Alice", age: 25 },
        { name: "Bob", age: 35 },
      ]);
      const result = collection.sortBy("age");
      expect(result.pluck("name").toArray()).toEqual(["Alice", "Charlie", "Bob"]);
    });

    test("sortByDesc() should sort by key descending", () => {
      const collection = collect([
        { name: "Charlie", age: 30 },
        { name: "Alice", age: 25 },
        { name: "Bob", age: 35 },
      ]);
      const result = collection.sortByDesc("age");
      expect(result.pluck("name").toArray()).toEqual(["Bob", "Charlie", "Alice"]);
    });

    test("reverse() should reverse order", () => {
      const result = collect([1, 2, 3]).reverse();
      expect(result.toArray()).toEqual([3, 2, 1]);
    });
  });

  describe("Filtering", () => {
    test("where() should filter by equality", () => {
      const collection = collect([
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
        { name: "Charlie", age: 25 },
      ]);
      const result = collection.where("age", 25);
      expect(result.count()).toBe(2);
    });

    test("where() with operator should filter", () => {
      const collection = collect([
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
        { name: "Charlie", age: 35 },
      ]);
      const result = collection.where("age", ">", 26);
      expect(result.count()).toBe(2);
    });

    test("whereIn() should filter by array", () => {
      const collection = collect([1, 2, 3, 4, 5]);
      const result = collection.whereIn(0 as any, [2, 4]); // Simple array doesn't have keys
      // For object arrays:
      const objCollection = collect([
        { id: 1 }, { id: 2 }, { id: 3 }
      ]);
      const objResult = objCollection.whereIn("id", [1, 3]);
      expect(objResult.count()).toBe(2);
    });

    test("unique() should get unique values", () => {
      const result = collect([1, 2, 2, 3, 3, 3]).unique();
      expect(result.toArray()).toEqual([1, 2, 3]);
    });

    test("unique() by key should get unique objects", () => {
      const collection = collect([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 1, name: "Alice2" },
      ]);
      const result = collection.unique("id");
      expect(result.count()).toBe(2);
    });
  });

  describe("Slicing", () => {
    test("take() should take first n items", () => {
      const result = collect([1, 2, 3, 4, 5]).take(3);
      expect(result.toArray()).toEqual([1, 2, 3]);
    });

    test("take() with negative should take last n items", () => {
      const result = collect([1, 2, 3, 4, 5]).take(-2);
      expect(result.toArray()).toEqual([4, 5]);
    });

    test("skip() should skip first n items", () => {
      const result = collect([1, 2, 3, 4, 5]).skip(2);
      expect(result.toArray()).toEqual([3, 4, 5]);
    });

    test("slice() should slice items", () => {
      const result = collect([1, 2, 3, 4, 5]).slice(1, 4);
      expect(result.toArray()).toEqual([2, 3, 4]);
    });
  });

  describe("Utility", () => {
    test("contains() should check if value exists", () => {
      expect(collect([1, 2, 3]).contains(2)).toBe(true);
      expect(collect([1, 2, 3]).contains(4)).toBe(false);
    });

    test("contains() with callback should check condition", () => {
      const result = collect([1, 2, 3, 4]).contains(n => n > 3);
      expect(result).toBe(true);
    });

    test("push() should add items", () => {
      const collection = collect([1, 2]);
      collection.push(3, 4);
      expect(collection.toArray()).toEqual([1, 2, 3, 4]);
    });

    test("toArray() should convert to array", () => {
      const array = collect([1, 2, 3]).toArray();
      expect(Array.isArray(array)).toBe(true);
    });

    test("toJson() should convert to JSON", () => {
      const json = collect([1, 2, 3]).toJson();
      expect(json).toBe("[1,2,3]");
    });

    test("implode() should join items", () => {
      const result = collect(["a", "b", "c"]).implode(",");
      expect(result).toBe("a,b,c");
    });
  });

  describe("Method Chaining", () => {
    test("should chain multiple methods", () => {
      const result = collect([1, 2, 3, 4, 5, 6])
        .filter(n => n > 2)
        .map(n => n * 2)
        .take(2);
      
      expect(result.toArray()).toEqual([6, 8]);
    });

    test("should chain complex operations", () => {
      const users = collect([
        { name: "Alice", age: 25, active: true },
        { name: "Bob", age: 30, active: false },
        { name: "Charlie", age: 35, active: true },
        { name: "David", age: 28, active: true },
      ]);

      const result = users
        .where("active", true)
        .sortBy("age")
        .pluck("name")
        .take(2);

      expect(result.toArray()).toEqual(["Alice", "David"]);
    });
  });

  describe("Iteration", () => {
    test("should be iterable with for...of", () => {
      const items: number[] = [];
      for (const item of collect([1, 2, 3])) {
        items.push(item);
      }
      expect(items).toEqual([1, 2, 3]);
    });
  });

  describe("Advanced", () => {
    test("pipe() should pass collection to callback", () => {
      const result = collect([1, 2, 3]).pipe(
        collection => collection.sum()
      );
      expect(result).toBe(6);
    });

    test("tap() should pass collection and return it", () => {
      let sum = 0;
      const collection = collect([1, 2, 3]).tap(
        c => sum = c.sum()
      );
      expect(sum).toBe(6);
      expect(collection.count()).toBe(3);
    });

    test("groupBy() should group items", () => {
      const collection = collect([
        { category: "A", value: 1 },
        { category: "B", value: 2 },
        { category: "A", value: 3 },
      ]);
      const groups = collection.groupBy("category");
      expect(groups.get("A")?.length).toBe(2);
      expect(groups.get("B")?.length).toBe(1);
    });

    test("diff() should get difference", () => {
      const result = collect([1, 2, 3, 4]).diff([2, 4]);
      expect(result.toArray()).toEqual([1, 3]);
    });

    test("zip() should zip arrays", () => {
      const result = collect([1, 2, 3]).zip(["a", "b", "c"]);
      expect(result.toArray()).toEqual([
        [1, "a"],
        [2, "b"],
        [3, "c"],
      ]);
    });
  });
});
