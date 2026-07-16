import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Model } from "../../src/core/database/Model";
import { Schema } from "../../src/core/database/Schema";
import { DatabaseConnection } from "../../src/core/database/Connection";

class ScopeTestUser extends Model {
  static override tableName = "scope_test_users";

  static {
    this.addScope("active", (query) => query.where("active", 1));
    this.addScope("olderThan", (query, age: number) => query.where("age", ">", age));
  }
}

class ScopeTestPost extends Model {
  static override tableName = "scope_test_posts";
}

describe("Local Scopes", () => {
  let connection: DatabaseConnection;

  beforeAll(async () => {
    connection = new DatabaseConnection({ driver: "sqlite", connection: { filename: ":memory:" } });
    connection.connect();
    Model.setConnection(connection);
    Schema.setConnection(connection);

    await Schema.create("scope_test_users", (table) => {
      table.id();
      table.string("name");
      table.integer("active");
      table.integer("age");
    });
    await Schema.create("scope_test_posts", (table) => {
      table.id();
      table.string("title");
    });

    new ScopeTestUser().fill({ name: "Alice", active: 1, age: 30 }).save();
    new ScopeTestUser().fill({ name: "Bob", active: 0, age: 25 }).save();
    new ScopeTestUser().fill({ name: "Carol", active: 1, age: 20 }).save();
  });

  afterAll(() => {
    connection.close();
  });

  test("scope() filters using the registered callback", () => {
    const results = ScopeTestUser.query().scope("active").get();
    expect(results.length).toBe(2);
  });

  test("chaining two scopes combines their conditions", () => {
    const results = ScopeTestUser.query().scope("active").scope("olderThan", 25).get();
    expect(results.length).toBe(1);
    expect(results[0]?.name).toBe("Alice");
  });

  test("scope() passes arguments through to the callback", () => {
    const results = ScopeTestUser.query().scope("olderThan", 22).get();
    expect(results.length).toBe(2);
  });

  test("throws for an unregistered scope name", () => {
    expect(() => ScopeTestUser.query().scope("nonexistent")).toThrow(
      'Scope "nonexistent" is not defined on ScopeTestUser.'
    );
  });

  test("scopes registered on one model do not leak onto a sibling model", () => {
    expect(() => ScopeTestPost.query().scope("active")).toThrow(
      'Scope "active" is not defined on ScopeTestPost.'
    );
  });
});
