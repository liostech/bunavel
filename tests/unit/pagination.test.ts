import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Model } from "../../src/core/database/Model";
import { Schema } from "../../src/core/database/Schema";
import { DatabaseConnection } from "../../src/core/database/Connection";
import { Paginator } from "../../src/core/database/Paginator";

// Test model
class User extends Model {
  static override tableName = "users";
}

describe("Pagination", () => {
  let connection: DatabaseConnection;

  beforeAll(() => {
    // Create in-memory database
    connection = new DatabaseConnection({
      driver: "sqlite",
      connection: { filename: ":memory:" },
    });
    connection.connect();

    Model.setConnection(connection);
    Schema.setConnection(connection);

    // Create table
    Schema.create("users", (table) => {
      table.id();
      table.string("name");
      table.string("email");
      table.timestamps();
    });

    // Seed data (create 50 users)
    for (let i = 1; i <= 50; i++) {
      User.create({
        name: `User ${i}`,
        email: `user${i}@example.com`,
      });
    }
  });

  beforeEach(() => {
    // No cleanup needed - we want the data to persist
  });

  afterAll(() => {
    connection.close();
  });

  describe("Paginator Class", () => {
    test("should create paginator with correct metadata", () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const paginator = new Paginator(items, 10, 5, 1);

      expect(paginator.getTotal()).toBe(10);
      expect(paginator.getPerPage()).toBe(5);
      expect(paginator.getCurrentPage()).toBe(1);
      expect(paginator.getLastPage()).toBe(2);
      expect(paginator.count()).toBe(3);
    });

    test("should calculate from and to correctly", () => {
      const items = [{ id: 6 }, { id: 7 }, { id: 8 }];
      const paginator = new Paginator(items, 10, 5, 2);

      expect(paginator.getFrom()).toBe(6);
      expect(paginator.getTo()).toBe(8);
    });

    test("should handle empty results", () => {
      const paginator = new Paginator([], 0, 10, 1);

      expect(paginator.getFrom()).toBe(0);
      expect(paginator.getTo()).toBe(0);
      expect(paginator.isEmpty()).toBe(true);
      expect(paginator.isNotEmpty()).toBe(false);
    });

    test("should detect first and last pages", () => {
      const items = [{ id: 1 }];
      
      const firstPage = new Paginator(items, 10, 5, 1);
      expect(firstPage.onFirstPage()).toBe(true);
      expect(firstPage.onLastPage()).toBe(false);

      const lastPage = new Paginator(items, 10, 5, 2);
      expect(lastPage.onFirstPage()).toBe(false);
      expect(lastPage.onLastPage()).toBe(true);
    });

    test("should check for more pages", () => {
      const items = [{ id: 1 }];
      
      const hasMore = new Paginator(items, 10, 5, 1);
      expect(hasMore.hasMorePages()).toBe(true);
      expect(hasMore.hasPreviousPage()).toBe(false);

      const noMore = new Paginator(items, 10, 5, 2);
      expect(noMore.hasMorePages()).toBe(false);
      expect(noMore.hasPreviousPage()).toBe(true);
    });

    test("should get next and previous page numbers", () => {
      const items = [{ id: 1 }];
      const paginator = new Paginator(items, 15, 5, 2);

      expect(paginator.previousPage()).toBe(1);
      expect(paginator.nextPage()).toBe(3);
    });

    test("should return null for next/previous when not available", () => {
      const items = [{ id: 1 }];
      
      const firstPage = new Paginator(items, 10, 5, 1);
      expect(firstPage.previousPage()).toBeNull();

      const lastPage = new Paginator(items, 10, 5, 2);
      expect(lastPage.nextPage()).toBeNull();
    });

    test("should get page range", () => {
      const items = [{ id: 1 }];
      const paginator = new Paginator(items, 100, 10, 5);

      const range = paginator.getPageRange(2);
      expect(range).toEqual([3, 4, 5, 6, 7]);
    });

    test("should adjust page range near beginning", () => {
      const items = [{ id: 1 }];
      const paginator = new Paginator(items, 100, 10, 2);

      const range = paginator.getPageRange(2);
      expect(range).toEqual([1, 2, 3, 4, 5]);
    });

    test("should adjust page range near end", () => {
      const items = [{ id: 1 }];
      const paginator = new Paginator(items, 100, 10, 9);

      const range = paginator.getPageRange(2);
      expect(range).toEqual([6, 7, 8, 9, 10]);
    });

    test("should convert to array", () => {
      const items = [{ id: 1 }, { id: 2 }];
      const paginator = new Paginator(items, 10, 5, 2);

      const result = paginator.toArray();

      expect(result).toMatchObject({
        data: items,
        current_page: 2,
        per_page: 5,
        total: 10,
        last_page: 2,
        from: 6,
        to: 7,
        first_page: 1,
        prev_page: 1,
        next_page: null,
      });
    });

    test("should convert to JSON", () => {
      const items = [{ id: 1 }];
      const paginator = new Paginator(items, 10, 5, 1);

      const json = paginator.toJSON();
      const parsed = JSON.parse(json);

      expect(parsed.current_page).toBe(1);
      expect(parsed.total).toBe(10);
    });

    test("should generate pagination links", () => {
      const items = [{ id: 1 }];
      const paginator = new Paginator(items, 30, 10, 2);

      const links = paginator.links("/users");

      expect(links[0]?.label).toBe("Previous");
      expect(links[0]?.url).toBe("/users?page=1");
      
      expect(links[links.length - 1]?.label).toBe("Next");
      expect(links[links.length - 1]?.url).toBe("/users?page=3");
      
      // Check active page
      const activePage = links.find(link => link.active);
      expect(activePage?.page).toBe(2);
    });
  });

  describe("QueryBuilder pagination", () => {
    test("should paginate query results", () => {
      const paginator = User.query().paginate(10, 1);

      expect(paginator.getTotal()).toBe(50);
      expect(paginator.getPerPage()).toBe(10);
      expect(paginator.getCurrentPage()).toBe(1);
      expect(paginator.getLastPage()).toBe(5);
      expect(paginator.count()).toBe(10);
    });

    test("should paginate with different page numbers", () => {
      const page1 = User.query().paginate(10, 1);
      const page2 = User.query().paginate(10, 2);

      // Check raw data from QueryBuilder
      expect(page1.data().first()?.name).toBe("User 1");
      expect(page2.data().first()?.name).toBe("User 11");
    });

    test("should paginate with where conditions", () => {
      const paginator = User.query()
        .where("id", "<=", 25)
        .paginate(10, 1);

      expect(paginator.getTotal()).toBe(25);
      expect(paginator.getLastPage()).toBe(3);
    });

    test("should paginate with order by", () => {
      const paginator = User.query()
        .orderBy("id", "DESC")
        .paginate(10, 1);

      // Check raw data from QueryBuilder
      expect(paginator.data().first()?.name).toBe("User 50");
    });

    test("should handle last page correctly", () => {
      const paginator = User.query().paginate(10, 5);

      expect(paginator.getCurrentPage()).toBe(5);
      expect(paginator.onLastPage()).toBe(true);
      expect(paginator.count()).toBe(10);
    });

    test("should handle page beyond last page", () => {
      const paginator = User.query().paginate(10, 10);

      expect(paginator.getCurrentPage()).toBe(10);
      expect(paginator.count()).toBe(0);
      expect(paginator.isEmpty()).toBe(true);
    });
  });

  describe("Model pagination", () => {
    test("should paginate all records", () => {
      const paginator = User.paginate(15, 1);

      expect(paginator.getTotal()).toBe(50);
      expect(paginator.getPerPage()).toBe(15);
      expect(paginator.count()).toBe(15);
      expect(paginator.getLastPage()).toBe(4);
    });

    test("should return hydrated models", () => {
      const paginator = User.paginate(10, 1);
      const firstUser = paginator.data().first();

      expect(firstUser).toBeInstanceOf(User);
      expect(firstUser?.get("name")).toBe("User 1");
    });

    test("should use default pagination", () => {
      const paginator = User.paginate();

      expect(paginator.getPerPage()).toBe(15);
      expect(paginator.getCurrentPage()).toBe(1);
    });

    test("should handle different page sizes", () => {
      const small = User.paginate(5, 1);
      const large = User.paginate(25, 1);

      expect(small.getLastPage()).toBe(10);
      expect(large.getLastPage()).toBe(2);
    });
  });
});
