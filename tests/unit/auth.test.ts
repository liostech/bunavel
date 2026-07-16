import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Hash } from "../../src/core/support/Hash";
import { Model } from "../../src/core/database/Model";
import { Schema } from "../../src/core/database/Schema";
import { DatabaseConnection } from "../../src/core/database/Connection";
import { EloquentUserProvider } from "../../src/core/auth/EloquentUserProvider";

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

class AuthTestUser extends Model {
  static override tableName = "auth_test_users";
}

describe("EloquentUserProvider", () => {
  let connection: DatabaseConnection;
  let provider: EloquentUserProvider<AuthTestUser>;
  let seededUserId: number;

  beforeAll(async () => {
    connection = new DatabaseConnection({ driver: "sqlite", connection: { filename: ":memory:" } });
    connection.connect();
    Model.setConnection(connection);
    Schema.setConnection(connection);

    await Schema.create("auth_test_users", (table) => {
      table.id();
      table.string("email");
      table.string("password");
    });

    const user = new AuthTestUser();
    user.fill({ email: "jane@example.com", password: await Hash.make("correct-password") });
    user.save();
    seededUserId = user.get("id");

    provider = new EloquentUserProvider(AuthTestUser);
  });

  afterAll(() => {
    connection.close();
  });

  test("retrieveById() returns the matching user", () => {
    const user = provider.retrieveById(seededUserId);
    expect(user).not.toBeNull();
    expect(user!.get("email")).toBe("jane@example.com");
  });

  test("retrieveById() returns null for an unknown id", () => {
    expect(provider.retrieveById(999999)).toBeNull();
  });

  test("retrieveByCredentials() returns the matching user by email", () => {
    const user = provider.retrieveByCredentials({ email: "jane@example.com" });
    expect(user).not.toBeNull();
    expect(user!.get("id")).toBe(seededUserId);
  });

  test("retrieveByCredentials() returns null for an unknown email", () => {
    expect(provider.retrieveByCredentials({ email: "nobody@example.com" })).toBeNull();
  });

  test("validateCredentials() returns true for the correct password", async () => {
    const user = provider.retrieveById(seededUserId)!;
    expect(await provider.validateCredentials(user, { password: "correct-password" })).toBe(true);
  });

  test("validateCredentials() returns false for the wrong password", async () => {
    const user = provider.retrieveById(seededUserId)!;
    expect(await provider.validateCredentials(user, { password: "wrong-password" })).toBe(false);
  });
});
