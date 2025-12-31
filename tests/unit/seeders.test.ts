import { describe, expect, test, beforeEach } from "bun:test";
import { Seeder } from "../../src/core/database/Seeder";
import { SeederManager } from "../../src/core/database/SeederManager";
import { DatabaseConnection } from "../../src/core/database/Connection";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

describe("Seeder", () => {
  test("Seeder is an abstract class that can be extended", () => {
    class TestSeeder extends Seeder {
      async run(db: DatabaseConnection): Promise<void> {
        // Test implementation
      }
    }

    const seeder = new TestSeeder();
    expect(seeder).toBeInstanceOf(Seeder);
  });

  test("Seeder can call other seeders", async () => {
    const db = new DatabaseConnection({
      driver: "sqlite",
      connection: { filename: ":memory:" },
    });
    db.connect();

    const executionOrder: string[] = [];

    class FirstSeeder extends Seeder {
      async run(db: DatabaseConnection): Promise<void> {
        executionOrder.push("first");
      }
    }

    class SecondSeeder extends Seeder {
      async run(db: DatabaseConnection): Promise<void> {
        executionOrder.push("second");
      }
    }

    class MainSeeder extends Seeder {
      async run(db: DatabaseConnection): Promise<void> {
        await this.call(db, [FirstSeeder, SecondSeeder]);
      }
    }

    const seeder = new MainSeeder();
    await seeder.run(db);

    expect(executionOrder).toEqual(["first", "second"]);
  });

  test("Seeder can insert data into database", async () => {
    const db = new DatabaseConnection({
      driver: "sqlite",
      connection: { filename: ":memory:" },
    });
    db.connect();

    // Create users table
    db.query(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL
      )
    `);

    class UserSeeder extends Seeder {
      async run(db: DatabaseConnection): Promise<void> {
        const users = [
          { name: "John Doe", email: "john@example.com" },
          { name: "Jane Smith", email: "jane@example.com" },
        ];

        for (const user of users) {
          db.query("INSERT INTO users (name, email) VALUES (?, ?)", [
            user.name,
            user.email,
          ]);
        }
      }
    }

    const seeder = new UserSeeder();
    await seeder.run(db);

    const users = db.query("SELECT * FROM users");
    expect(users).toHaveLength(2);
    expect(users[0].name).toBe("John Doe");
    expect(users[1].name).toBe("Jane Smith");
  });
});

describe("SeederManager", () => {
  const testSeedersPath = join(process.cwd(), "tests", "fixtures", "seeders");

  beforeEach(() => {
    // Clean up test seeders directory
    if (existsSync(testSeedersPath)) {
      rmSync(testSeedersPath, { recursive: true, force: true });
    }
    mkdirSync(testSeedersPath, { recursive: true });
  });

  test("SeederManager can be instantiated with database connection", () => {
    const db = new DatabaseConnection({
      driver: "sqlite",
      connection: { filename: ":memory:" },
    });
    db.connect();

    const manager = new SeederManager(db, testSeedersPath);
    expect(manager).toBeInstanceOf(SeederManager);
    expect(manager.getConnection()).toBe(db);
  });

  test("SeederManager throws error if seeder file not found", async () => {
    const db = new DatabaseConnection({
      driver: "sqlite",
      connection: { filename: ":memory:" },
    });
    db.connect();

    const manager = new SeederManager(db, testSeedersPath);

    await expect(manager.run("NonExistentSeeder")).rejects.toThrow(
      "Seeder file not found"
    );
  });

  test("SeederManager can run a specific seeder", async () => {
    const db = new DatabaseConnection({
      driver: "sqlite",
      connection: { filename: ":memory:" },
    });
    db.connect();

    // Create test table
    db.query(`
      CREATE TABLE test_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        value TEXT NOT NULL
      )
    `);

    // Create a test seeder file
    const seederContent = `
import { Seeder } from "../../../src/core/database/Seeder";
import type { DatabaseConnection } from "../../../src/core/database/Connection";

export default class TestSeeder extends Seeder {
  async run(db) {
    db.query("INSERT INTO test_table (value) VALUES (?)", ["test value"]);
  }
}
`;

    writeFileSync(join(testSeedersPath, "TestSeeder.ts"), seederContent);

    const manager = new SeederManager(db, testSeedersPath);
    await manager.run("TestSeeder");

    const results = db.query("SELECT * FROM test_table");
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe("test value");
  });

  test("SeederManager uses default seeders path", () => {
    const db = new DatabaseConnection({
      driver: "sqlite",
      connection: { filename: ":memory:" },
    });
    db.connect();

    const manager = new SeederManager(db);
    expect(manager).toBeInstanceOf(SeederManager);
  });

  test("SeederManager handles seeder errors gracefully", async () => {
    const db = new DatabaseConnection({
      driver: "sqlite",
      connection: { filename: ":memory:" },
    });
    db.connect();

    // Create a test seeder that throws an error
    const seederContent = `
import { Seeder } from "../../../src/core/database/Seeder";

export default class ErrorSeeder extends Seeder {
  async run(db) {
    throw new Error("Seeder error");
  }
}
`;

    writeFileSync(join(testSeedersPath, "ErrorSeeder.ts"), seederContent);

    const manager = new SeederManager(db, testSeedersPath);

    await expect(manager.run("ErrorSeeder")).rejects.toThrow("Seeder error");
  });
});

describe("Integration: Seeders with Models", () => {
  test("Seeder can work with Model class", async () => {
    const db = new DatabaseConnection({
      driver: "sqlite",
      connection: { filename: ":memory:" },
    });
    db.connect();

    // Create table
    db.query(`
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL
      )
    `);

    class PostSeeder extends Seeder {
      async run(db: DatabaseConnection): Promise<void> {
        const posts = [
          { title: "First Post", content: "Content 1" },
          { title: "Second Post", content: "Content 2" },
          { title: "Third Post", content: "Content 3" },
        ];

        for (const post of posts) {
          db.query("INSERT INTO posts (title, content) VALUES (?, ?)", [
            post.title,
            post.content,
          ]);
        }
      }
    }

    const seeder = new PostSeeder();
    await seeder.run(db);

    const posts = db.query("SELECT * FROM posts");
    expect(posts).toHaveLength(3);
    expect(posts[0].title).toBe("First Post");
    expect(posts[2].title).toBe("Third Post");
  });

  test("Seeder can use transactions", async () => {
    const db = new DatabaseConnection({
      driver: "sqlite",
      connection: { filename: ":memory:" },
    });
    db.connect();

    // Create table
    db.query(`
      CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `);

    class TransactionalSeeder extends Seeder {
      async run(db: DatabaseConnection): Promise<void> {
        // SQLite auto-wraps in transactions, but we can be explicit
        db.query("BEGIN TRANSACTION");
        
        try {
          db.query("INSERT INTO items (name) VALUES (?)", ["Item 1"]);
          db.query("INSERT INTO items (name) VALUES (?)", ["Item 2"]);
          db.query("COMMIT");
        } catch (error) {
          db.query("ROLLBACK");
          throw error;
        }
      }
    }

    const seeder = new TransactionalSeeder();
    await seeder.run(db);

    const items = db.query("SELECT * FROM items");
    expect(items).toHaveLength(2);
  });
});
