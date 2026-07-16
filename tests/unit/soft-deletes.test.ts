import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Model } from "../../src/core/database/Model";
import { SoftDeletes } from "../../src/core/database/SoftDeletes";
import { Schema } from "../../src/core/database/Schema";
import { DatabaseConnection } from "../../src/core/database/Connection";

class SoftDeleteTestPost extends SoftDeletes(Model) {
  static override tableName = "soft_delete_test_posts";
}

describe("SoftDeletes", () => {
  let connection: DatabaseConnection;

  beforeAll(async () => {
    connection = new DatabaseConnection({ driver: "sqlite", connection: { filename: ":memory:" } });
    connection.connect();
    Model.setConnection(connection);
    Schema.setConnection(connection);

    await Schema.create("soft_delete_test_posts", (table) => {
      table.id();
      table.string("title");
      table.string("deleted_at").nullable();
    });
  });

  afterAll(() => {
    connection.close();
  });

  test("delete() sets deleted_at instead of removing the row", () => {
    const post = new SoftDeleteTestPost();
    post.fill({ title: "First" }).save();
    const id = post.get("id");

    post.delete();

    expect(post.trashed()).toBe(true);
    expect(SoftDeleteTestPost.find(id)).toBeNull();
    expect(SoftDeleteTestPost.withTrashed().find(id)).toBeTruthy();
  });

  test("all()/find() exclude soft-deleted rows by default", () => {
    const post = new SoftDeleteTestPost();
    post.fill({ title: "Second" }).save();
    post.delete();

    const all = SoftDeleteTestPost.all();
    expect(all.toArray().some((p) => p.get("title") === "Second")).toBe(false);
  });

  test("withTrashed() includes soft-deleted rows", () => {
    const post = new SoftDeleteTestPost();
    post.fill({ title: "Third" }).save();
    post.delete();

    const results = SoftDeleteTestPost.withTrashed().get();
    expect(results.some((r: any) => r.title === "Third")).toBe(true);
  });

  test("onlyTrashed() returns only soft-deleted rows", () => {
    const active = new SoftDeleteTestPost();
    active.fill({ title: "Active" }).save();

    const trashed = new SoftDeleteTestPost();
    trashed.fill({ title: "ToTrash" }).save();
    trashed.delete();

    const results = SoftDeleteTestPost.onlyTrashed().get();
    expect(results.every((r: any) => r.deleted_at != null)).toBe(true);
    expect(results.some((r: any) => r.title === "ToTrash")).toBe(true);
    expect(results.some((r: any) => r.title === "Active")).toBe(false);
  });

  test("restore() clears deleted_at and un-hides the row", () => {
    const post = new SoftDeleteTestPost();
    post.fill({ title: "Restorable" }).save();
    const id = post.get("id");
    post.delete();

    expect(SoftDeleteTestPost.find(id)).toBeNull();

    post.restore();

    expect(post.trashed()).toBe(false);
    expect(SoftDeleteTestPost.find(id)).toBeTruthy();
  });

  test("forceDelete() physically removes the row", () => {
    const post = new SoftDeleteTestPost();
    post.fill({ title: "Gone" }).save();
    const id = post.get("id");

    post.forceDelete();

    expect(SoftDeleteTestPost.withTrashed().find(id)).toBeNull();
  });

  test("a plain Model without the mixin is unaffected by the scope", () => {
    class PlainPost extends Model {
      static override tableName = "soft_delete_test_posts";
    }

    const visibleToSoftDeleteAware = SoftDeleteTestPost.all().toArray().length;
    const visibleToPlain = PlainPost.all().toArray().length;

    expect(visibleToPlain).toBeGreaterThan(visibleToSoftDeleteAware);
  });
});
