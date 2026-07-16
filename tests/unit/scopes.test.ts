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

class GlobalScopeTestUser extends Model {
  static override tableName = "global_scope_test_users";

  static {
    this.addGlobalScope("active", (query) => query.where("active", 1));
  }
}

describe("Global Scopes", () => {
  let connection: DatabaseConnection;

  beforeAll(async () => {
    connection = new DatabaseConnection({ driver: "sqlite", connection: { filename: ":memory:" } });
    connection.connect();
    Model.setConnection(connection);
    Schema.setConnection(connection);

    await Schema.create("global_scope_test_users", (table) => {
      table.id();
      table.string("name");
      table.integer("active");
    });

    new GlobalScopeTestUser().fill({ name: "Alice", active: 1 }).save();
    new GlobalScopeTestUser().fill({ name: "Bob", active: 0 }).save();
    new GlobalScopeTestUser().fill({ name: "Carol", active: 1 }).save();
  });

  afterAll(() => {
    connection.close();
  });

  test("applies automatically to reads with no explicit opt-in", () => {
    const results = GlobalScopeTestUser.query().get();
    expect(results.length).toBe(2);
  });

  test("all() respects the global scope", () => {
    const results = GlobalScopeTestUser.all();
    expect(results.toArray().length).toBe(2);
  });

  test("withoutGlobalScope(name) restores excluded rows for that query only", () => {
    const withScope = GlobalScopeTestUser.query().get();
    expect(withScope.length).toBe(2);

    const withoutScope = GlobalScopeTestUser.query().withoutGlobalScope("active").get();
    expect(withoutScope.length).toBe(3);
  });

  test("withoutGlobalScopes() excludes every global scope", () => {
    const results = GlobalScopeTestUser.query().withoutGlobalScopes().get();
    expect(results.length).toBe(3);
  });

  test("does not double-apply the scope across multiple buildSelectQuery calls on the same builder", () => {
    const paginator = GlobalScopeTestUser.query().paginate(10, 1);
    expect(paginator.getTotal()).toBe(2);
    expect(paginator.data().toArray().length).toBe(2);
  });

  test("combines with a local scope in the same query", () => {
    GlobalScopeTestUser.addScope("namedAlice", (query) => query.where("name", "=", "Alice"));

    const results = GlobalScopeTestUser.query().scope("namedAlice").get();
    // global "active" scope (active=1) AND local "namedAlice" scope both apply
    expect(results.length).toBe(1);
    expect(results[0]?.name).toBe("Alice");
  });

  test("global scope callback runs exactly once per query builder instance, even across two buildSelectQuery() calls", () => {
    // A row-count assertion alone can't distinguish "applied once" from "applied
    // twice" here, because ANDing an idempotent equality condition with itself
    // doesn't change the result set. Use an invocation counter instead to prove
    // the guard actually short-circuits the second buildSelectQuery() call
    // (paginate() invokes it twice: once via count(), once via get()).
    let invocationCount = 0;

    class CountedGlobalScopeUser extends Model {
      static override tableName = "global_scope_test_users";

      static {
        this.addGlobalScope("counted", (query) => {
          invocationCount++;
          query.where("active", 1);
        });
      }
    }

    CountedGlobalScopeUser.query().paginate(10, 1);

    expect(invocationCount).toBe(1);
  });
});
