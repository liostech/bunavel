import { describe, test, expect } from "bun:test";
import { Str, str } from "../../src/core/support/Str";

describe("Str", () => {
  describe("case conversion", () => {
    test("camel() converts to camelCase", () => {
      expect(Str.camel("hello_world")).toBe("helloWorld");
      expect(Str.camel("hello-world")).toBe("helloWorld");
      expect(Str.camel("hello world")).toBe("helloWorld");
      expect(Str.camel("HelloWorld")).toBe("helloWorld");
    });

    test("studly() converts to PascalCase", () => {
      expect(Str.studly("hello_world")).toBe("HelloWorld");
      expect(Str.studly("hello-world")).toBe("HelloWorld");
      expect(Str.studly("hello world")).toBe("HelloWorld");
      expect(Str.studly("helloWorld")).toBe("HelloWorld");
    });

    test("snake() converts to snake_case", () => {
      expect(Str.snake("helloWorld")).toBe("hello_world");
      expect(Str.snake("HelloWorld")).toBe("hello_world");
      expect(Str.snake("hello-world")).toBe("hello_world");
      expect(Str.snake("hello world")).toBe("hello_world");
    });

    test("kebab() converts to kebab-case", () => {
      expect(Str.kebab("helloWorld")).toBe("hello-world");
      expect(Str.kebab("HelloWorld")).toBe("hello-world");
      expect(Str.kebab("hello_world")).toBe("hello-world");
      expect(Str.kebab("hello world")).toBe("hello-world");
    });

    test("title() converts to Title Case", () => {
      expect(Str.title("hello world")).toBe("Hello World");
      expect(Str.title("hello_world")).toBe("Hello World");
      expect(Str.title("hello-world")).toBe("Hello World");
    });
  });

  describe("substring operations", () => {
    test("after() gets substring after first occurrence", () => {
      expect(Str.after("hello-world-foo", "-")).toBe("world-foo");
      expect(Str.after("hello", "-")).toBe("hello");
    });

    test("afterLast() gets substring after last occurrence", () => {
      expect(Str.afterLast("hello-world-foo", "-")).toBe("foo");
      expect(Str.afterLast("hello", "-")).toBe("hello");
    });

    test("before() gets substring before first occurrence", () => {
      expect(Str.before("hello-world-foo", "-")).toBe("hello");
      expect(Str.before("hello", "-")).toBe("hello");
    });

    test("beforeLast() gets substring before last occurrence", () => {
      expect(Str.beforeLast("hello-world-foo", "-")).toBe("hello-world");
      expect(Str.beforeLast("hello", "-")).toBe("hello");
    });
  });

  describe("checking methods", () => {
    test("contains() checks for substring", () => {
      expect(Str.contains("hello world", "world")).toBe(true);
      expect(Str.contains("hello world", "foo")).toBe(false);
      expect(Str.contains("hello world", ["foo", "world"])).toBe(true);
      expect(Str.contains("hello world", ["foo", "bar"])).toBe(false);
    });

    test("startsWith() checks string start", () => {
      expect(Str.startsWith("hello world", "hello")).toBe(true);
      expect(Str.startsWith("hello world", "world")).toBe(false);
      expect(Str.startsWith("hello world", ["foo", "hello"])).toBe(true);
    });

    test("endsWith() checks string end", () => {
      expect(Str.endsWith("hello world", "world")).toBe(true);
      expect(Str.endsWith("hello world", "hello")).toBe(false);
      expect(Str.endsWith("hello world", ["foo", "world"])).toBe(true);
    });
  });

  describe("limiting methods", () => {
    test("limit() limits string length", () => {
      expect(Str.limit("hello world", 5)).toBe("hello...");
      expect(Str.limit("hello", 10)).toBe("hello");
      expect(Str.limit("hello world", 5, "!!!")).toBe("hello!!!");
    });

    test("words() limits word count", () => {
      expect(Str.words("hello world foo bar", 2)).toBe("hello world...");
      expect(Str.words("hello world", 5)).toBe("hello world");
      expect(Str.words("hello world foo", 2, "!!!")).toBe("hello world!!!");
    });
  });

  describe("manipulation methods", () => {
    test("random() generates random string", () => {
      const str1 = Str.random(10);
      const str2 = Str.random(10);
      expect(str1).toHaveLength(10);
      expect(str2).toHaveLength(10);
      expect(str1).not.toBe(str2);
    });

    test("repeat() repeats string", () => {
      expect(Str.repeat("ab", 3)).toBe("ababab");
      expect(Str.repeat("x", 5)).toBe("xxxxx");
    });

    test("replaceFirst() replaces first occurrence", () => {
      expect(Str.replaceFirst("hello world world", "world", "foo")).toBe("hello foo world");
      expect(Str.replaceFirst("hello", "world", "foo")).toBe("hello");
    });

    test("replaceLast() replaces last occurrence", () => {
      expect(Str.replaceLast("hello world world", "world", "foo")).toBe("hello world foo");
      expect(Str.replaceLast("hello", "world", "foo")).toBe("hello");
    });

    test("plural() pluralizes words", () => {
      expect(Str.plural("user")).toBe("users");
      expect(Str.plural("box")).toBe("boxes");
      expect(Str.plural("country")).toBe("countries");
      expect(Str.plural("user", 1)).toBe("user");
      expect(Str.plural("user", 2)).toBe("users");
    });

    test("singular() singularizes words", () => {
      expect(Str.singular("users")).toBe("user");
      expect(Str.singular("boxes")).toBe("box");
      expect(Str.singular("countries")).toBe("country");
    });

    test("padBoth() pads both sides", () => {
      expect(Str.padBoth("hello", 11)).toBe("   hello   ");
      expect(Str.padBoth("hello", 9, "-")).toBe("--hello--");
    });

    test("squish() removes extra whitespace", () => {
      expect(Str.squish("  hello   world  ")).toBe("hello world");
      expect(Str.squish("hello\n\nworld")).toBe("hello world");
    });

    test("reverse() reverses string", () => {
      expect(Str.reverse("hello")).toBe("olleh");
      expect(Str.reverse("12345")).toBe("54321");
    });
  });

  describe("str() fluent helper", () => {
    test("should provide fluent interface", () => {
      expect(str("hello_world").camel()).toBe("helloWorld");
      expect(str("helloWorld").snake()).toBe("hello_world");
      expect(str("hello").repeat(3)).toBe("hellohellohello");
    });

    test("should chain operations", () => {
      const result = str("  hello-world  ")
        .toString()
        .trim();
      expect(result).toBe("hello-world");
    });
  });
});
