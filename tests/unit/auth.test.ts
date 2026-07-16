import { describe, test, expect } from "bun:test";
import { Hash } from "../../src/core/support/Hash";

describe("Hash", () => {
  test("make() returns a hash different from the plaintext", async () => {
    const hashed = await Hash.make("secret123");
    expect(typeof hashed).toBe("string");
    expect(hashed).not.toBe("secret123");
  });

  test("check() returns true for the correct plaintext", async () => {
    const hashed = await Hash.make("secret123");
    expect(await Hash.check("secret123", hashed)).toBe(true);
  });

  test("check() returns false for the wrong plaintext", async () => {
    const hashed = await Hash.make("secret123");
    expect(await Hash.check("wrong-password", hashed)).toBe(false);
  });
});
