import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { DatabaseConnection } from "../../src/core/database/Connection";
import { QueryBuilder } from "../../src/core/database/QueryBuilder";

describe("QueryBuilder", () => {
  let connection: DatabaseConnection;
  let builder: QueryBuilder;

  beforeEach(() => {
    // Create in-memory database
    connection = new DatabaseConnection({
      driver: "sqlite",
      connection: { filename: ":memory:" },
    });
    connection.connect();

    // Create test table
    connection.execute(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        age INTEGER,
        active INTEGER DEFAULT 1
      )
    `);

    // Insert test data
    connection.execute(
      "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
      ["Alice", "alice@example.com", 25]
    );
    connection.execute(
      "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
      ["Bob", "bob@example.com", 30]
    );
    connection.execute(
      "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
      ["Charlie", "charlie@example.com", 35]
    );

    builder = new QueryBuilder(connection);
  });

  afterEach(() => {
    connection.close();
  });

  describe("Select Queries", () => {
    test("should get all records", () => {
      const users = builder.table("users").get();

      expect(users.length).toBe(3);
      expect(users[0]?.name).toBe("Alice");
    });

    test("should select specific columns", () => {
      const users = builder.table("users").select("name", "email").get();

      expect(users.length).toBe(3);
      expect(users[0]?.name).toBeDefined();
      expect(users[0]?.email).toBeDefined();
      expect(users[0]?.age).toBeUndefined();
    });

    test("should get first record", () => {
      const user = builder.table("users").first();

      expect(user).toBeDefined();
      expect(user.name).toBe("Alice");
    });

    test("should find record by ID", () => {
      const user = builder.table("users").find(2);

      expect(user).toBeDefined();
      expect(user.name).toBe("Bob");
    });

    test("should count records", () => {
      const count = builder.table("users").count();

      expect(count).toBe(3);
    });
  });

  describe("Where Clauses", () => {
    test("should filter with WHERE clause", () => {
      const users = builder.table("users").where("name", "=", "Alice").get();

      expect(users.length).toBe(1);
      expect(users[0]?.name).toBe("Alice");
    });

    test("should use default = operator", () => {
      const users = builder.table("users").where("name", "Alice").get();

      expect(users.length).toBe(1);
      expect(users[0]?.name).toBe("Alice");
    });

    test("should chain multiple WHERE clauses", () => {
      const users = builder
        .table("users")
        .where("age", ">", 25)
        .where("age", "<", 35)
        .get();

      expect(users.length).toBe(1);
      expect(users[0]?.name).toBe("Bob");
    });

    test("should filter with WHERE IN", () => {
      const users = builder
        .table("users")
        .whereIn("name", ["Alice", "Charlie"])
        .get();

      expect(users.length).toBe(2);
    });

    test("should filter with WHERE NULL", () => {
      // Insert a user with null age
      connection.execute(
        "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
        ["David", "david@example.com", null]
      );

      const users = builder.table("users").whereNull("age").get();

      expect(users.length).toBe(1);
      expect(users[0]?.name).toBe("David");
    });

    test("should filter with WHERE NOT NULL", () => {
      const users = builder.table("users").whereNotNull("age").get();

      expect(users.length).toBe(3);
    });
  });

  describe("Ordering and Limiting", () => {
    test("should order by column ASC", () => {
      const users = builder.table("users").orderBy("age", "ASC").get();

      expect(users[0]?.name).toBe("Alice");
      expect(users[2]?.name).toBe("Charlie");
    });

    test("should order by column DESC", () => {
      const users = builder.table("users").orderBy("age", "DESC").get();

      expect(users[0]?.name).toBe("Charlie");
      expect(users[2]?.name).toBe("Alice");
    });

    test("should limit results", () => {
      const users = builder.table("users").limit(2).get();

      expect(users.length).toBe(2);
    });

    test("should offset results", () => {
      const users = builder.table("users").orderBy("id", "ASC").offset(1).get();

      expect(users.length).toBe(2);
      expect(users[0]?.name).toBe("Bob");
    });

    test("should combine limit and offset", () => {
      const users = builder
        .table("users")
        .orderBy("id", "ASC")
        .limit(1)
        .offset(1)
        .get();

      expect(users.length).toBe(1);
      expect(users[0]?.name).toBe("Bob");
    });
  });

  describe("Insert Operations", () => {
    test("should insert new record", () => {
      const id = builder.table("users").insert({
        name: "David",
        email: "david@example.com",
        age: 28,
      });

      expect(id).toBeGreaterThan(0);

      const user = builder.table("users").find(id);
      expect(user.name).toBe("David");
    });

    test("should return last insert ID", () => {
      const id = builder.table("users").insert({
        name: "Eve",
        email: "eve@example.com",
        age: 26,
      });

      expect(id).toBe(4);
    });
  });

  describe("Update Operations", () => {
    test("should update records", () => {
      const changes = builder
        .table("users")
        .where("name", "Alice")
        .update({ age: 26 });

      expect(changes).toBe(1);

      const user = builder.table("users").where("name", "Alice").first();
      expect(user.age).toBe(26);
    });

    test("should update multiple records", () => {
      const changes = builder
        .table("users")
        .where("age", ">", 25)
        .update({ active: 0 });

      expect(changes).toBe(2); // Bob and Charlie
    });
  });

  describe("Delete Operations", () => {
    test("should delete records", () => {
      const deleted = builder.table("users").where("name", "Alice").delete();

      expect(deleted).toBe(1);

      const users = new QueryBuilder(connection).table("users").get();
      expect(users.length).toBe(2);
    });

    test("should delete multiple records", () => {
      const deleted = builder.table("users").where("age", ">", 25).delete();

      expect(deleted).toBe(2); // Bob and Charlie

      const users = new QueryBuilder(connection).table("users").get();
      expect(users.length).toBe(1);
      expect(users[0]?.name).toBe("Alice");
    });
  });

  describe("Exists Check", () => {
    test("should return true when records exist", () => {
      const exists = builder.table("users").where("name", "Alice").exists();

      expect(exists).toBe(true);
    });

    test("should return false when no records exist", () => {
      const exists = builder
        .table("users")
        .where("name", "NonExistent")
        .exists();

      expect(exists).toBe(false);
    });
  });

  describe("Method Chaining", () => {
    test("should chain multiple methods", () => {
      const users = builder
        .table("users")
        .select("name", "age")
        .where("age", ">", 25)
        .orderBy("age", "DESC")
        .limit(2)
        .get();

      expect(users.length).toBe(2);
      expect(users[0]?.name).toBe("Charlie");
      expect(users[1]?.name).toBe("Bob");
    });
  });
});
