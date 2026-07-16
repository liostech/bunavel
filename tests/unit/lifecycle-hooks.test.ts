import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Model } from "../../src/core/database/Model";
import { Schema } from "../../src/core/database/Schema";
import { DatabaseConnection } from "../../src/core/database/Connection";

describe("Model Lifecycle Hooks", () => {
  let connection: DatabaseConnection;

  beforeAll(async () => {
    connection = new DatabaseConnection({ driver: "sqlite", connection: { filename: ":memory:" } });
    connection.connect();
    Model.setConnection(connection);
    Schema.setConnection(connection);

    await Schema.create("hook_test_users", (table) => {
      table.id();
      table.string("name");
      table.string("uuid").nullable();
    });
  });

  afterAll(() => {
    connection.close();
  });

  test("creating fires before insert and can mutate the model", () => {
    class TestUser extends Model {
      static override tableName = "hook_test_users";
      static {
        this.creating((user) => {
          user.set("uuid", "generated-uuid");
        });
      }
    }

    const user = new TestUser();
    user.fill({ name: "Alice" });
    user.save();

    expect(user.get("uuid")).toBe("generated-uuid");
    const reloaded = TestUser.find(user.get("id"));
    expect(reloaded?.get("uuid")).toBe("generated-uuid");
  });

  test("created fires after insert", () => {
    const calls: string[] = [];
    class TestUser extends Model {
      static override tableName = "hook_test_users";
      static {
        this.created(() => {
          calls.push("created");
        });
      }
    }

    const user = new TestUser();
    user.fill({ name: "Bob" });
    user.save();

    expect(calls).toEqual(["created"]);
  });

  test("saving/saved fire on both insert and update", () => {
    const calls: string[] = [];
    class TestUser extends Model {
      static override tableName = "hook_test_users";
      static {
        this.saving(() => {
          calls.push("saving");
        });
        this.saved(() => {
          calls.push("saved");
        });
      }
    }

    const user = new TestUser();
    user.fill({ name: "Carol" });
    user.save();
    expect(calls).toEqual(["saving", "saved"]);

    calls.length = 0;
    user.set("name", "Carol Updated");
    user.save();
    expect(calls).toEqual(["saving", "saved"]);
  });

  test("updating/updated fire only on update, not insert", () => {
    const calls: string[] = [];
    class TestUser extends Model {
      static override tableName = "hook_test_users";
      static {
        this.updating(() => {
          calls.push("updating");
        });
        this.updated(() => {
          calls.push("updated");
        });
      }
    }

    const user = new TestUser();
    user.fill({ name: "Dave" });
    user.save();
    expect(calls).toEqual([]);

    user.set("name", "Dave Updated");
    user.save();
    expect(calls).toEqual(["updating", "updated"]);
  });

  test("returning false from creating aborts the insert", () => {
    class TestUser extends Model {
      static override tableName = "hook_test_users";
      static {
        this.creating(() => false);
      }
    }

    const user = new TestUser();
    user.fill({ name: "Cancelled" });
    const result = user.save();

    expect(result).toBe(false);
    expect(user.exists).toBe(false);
  });

  test("returning false from updating aborts the update", () => {
    class TestUser extends Model {
      static override tableName = "hook_test_users";
      static {
        this.updating(() => false);
      }
    }

    const user = new TestUser();
    user.fill({ name: "ToUpdate" });
    user.save(); // insert succeeds — updating hook doesn't fire on insert
    const id = user.get("id");

    user.set("name", "ShouldNotSave");
    const result = user.save();

    expect(result).toBe(false);

    const reloaded = TestUser.find(id);
    expect(reloaded?.get("name")).toBe("ToUpdate");
  });

  test("deleting fires before delete and returning false cancels it", () => {
    class TestUser extends Model {
      static override tableName = "hook_test_users";
      static {
        this.deleting(() => false);
      }
    }

    const user = new TestUser();
    user.fill({ name: "ToDelete" });
    user.save();
    const id = user.get("id");

    const result = user.delete();

    expect(result).toBe(false);
    expect(user.exists).toBe(true);
    expect(TestUser.find(id)).not.toBeNull();
  });

  test("deleted fires after a successful delete", () => {
    const calls: string[] = [];
    class TestUser extends Model {
      static override tableName = "hook_test_users";
      static {
        this.deleted(() => {
          calls.push("deleted");
        });
      }
    }

    const user = new TestUser();
    user.fill({ name: "WillBeDeleted" });
    user.save();
    user.delete();

    expect(calls).toEqual(["deleted"]);
  });

  test("multiple callbacks for the same hook all run in order until one returns false", () => {
    const calls: string[] = [];
    class TestUser extends Model {
      static override tableName = "hook_test_users";
      static {
        this.creating(() => {
          calls.push("first");
        });
        this.creating(() => {
          calls.push("second");
          return false;
        });
        this.creating(() => {
          calls.push("third");
        });
      }
    }

    const user = new TestUser();
    user.fill({ name: "Multi" });
    const result = user.save();

    expect(result).toBe(false);
    expect(calls).toEqual(["first", "second"]);
  });

  test("hooks registered on one model do not fire for a sibling model", () => {
    const calls: string[] = [];
    class TestUserWithHook extends Model {
      static override tableName = "hook_test_users";
      static {
        this.creating(() => {
          calls.push("should-not-fire");
        });
      }
    }
    class SiblingUser extends Model {
      static override tableName = "hook_test_users";
    }

    const sibling = new SiblingUser();
    sibling.fill({ name: "NoHooks" });
    sibling.save();

    expect(calls).toEqual([]);
  });
});
