# Model Lifecycle Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Laravel-style model lifecycle hooks (`creating`/`created`, `updating`/`updated`, `saving`/`saved`, `deleting`/`deleted` on `Model`; `restoring`/`restored` on `SoftDeletes`) with Laravel-exact cancellation semantics — an "ing" hook returning `false` aborts the operation.

**Architecture:** A `WeakMap<typeof Model, Map<string, HookCallback[]>>` registry (same per-class pattern query-scopes established), with `registerHook`/`fireHook` static helpers and 8 public static registration methods on `Model`. `save()` and `delete()` are modified to call `fireHook()` at the right points, checking for `false` to short-circuit. `SoftDeletes.ts` is updated to explicitly re-dispatch `deleting`/`deleted` around its soft `delete()` (since it calls `save()`, not `super.delete()`, and would otherwise never fire them) and to add `restoring`/`restored`.

**Tech Stack:** Bun, TypeScript, `bun:test`, the existing `Model`/`QueryBuilder`/`SoftDeletes`/`Schema`/`DatabaseConnection` classes.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-model-lifecycle-hooks-design.md` — read it if anything below is ambiguous.
- Run the full suite with `bun test` (currently 436 pass / 0 fail — must stay green after every task).
- `verbatimModuleSyntax` is enabled in `tsconfig.json` — any import used only as a type MUST use `import type { X }`.
- Cancellation check is strict `=== false` — a callback returning `undefined`, nothing, or any other falsy/truthy value does NOT cancel. Only the "ing" hooks (`creating`, `updating`, `saving`, `deleting`, `restoring`) can cancel; the "after" hooks (`created`, `updated`, `saved`, `deleted`, `restored`) never do (matches Laravel exactly).
- `registerHook`/`fireHook` are `public static` (not `protected`) — matching the existing precedent set by `addScope`/`getScope`/`addGlobalScope`/`getGlobalScopes` (all public on `Model` already), and avoiding any uncertainty about TypeScript's protected-static-member access rules across the `SoftDeletes.ts` file boundary. There is no compelling reason for these to be protected; simplicity and precedent consistency win.
- `Model.create()`, `Model.updateWhere()`, `Model.deleteWhere()` are NOT touched by this plan — hooks fire only through the instance methods `save()`/`delete()` (and `SoftDeletes.restore()`). See the spec's Non-goals for why (these bulk/static helpers already bypass instance-level behavior — `deleteWhere()` doesn't respect soft deletes either).
- Test fixtures use fresh, test-local model classes (defined inside each `test()` body, not shared at module/describe level) specifically *because* hook registries persist for the lifetime of a class — a hook registered on a shared class in one test would still be registered (and firing) in every later test in the same file. This is a deliberate test-isolation choice, not incidental style; follow it exactly, don't "simplify" to shared top-level test classes.

---

## File Structure

Modified files:
- `src/core/database/Model.ts` — add `HookCallback` type, `hooksRegistry`, `registerHook`/`fireHook`, 8 registration methods, hook-firing calls in `save()`/`delete()`
- `src/core/database/SoftDeletes.ts` — `delete()`/`restore()` wrap `fireHook()` calls; add `restoring`/`restored` registration methods
- `src/index.ts` — export `HookCallback` (type-only; added in Task 1 alongside its definition, no dedicated test — same reasoning as `ScopeCallback` in the query-scopes plan: a type-only export can't produce a bun:test-verifiable RED state, since both the export line and a test's `import type` are erased at transpile time regardless of whether the line exists)

New files:
- `tests/unit/lifecycle-hooks.test.ts` — built up across both tasks

---

### Task 1: `Model` lifecycle hooks

**Files:**
- Modify: `src/core/database/Model.ts` (targeted insert + two method-body replacements, not a full-file rewrite)
- Modify: `src/index.ts` (one new export)
- Create: `tests/unit/lifecycle-hooks.test.ts`

**Interfaces:**
- Produces: `HookCallback = (model: Model) => boolean | void`, `Model.registerHook(name, callback): void`, `Model.fireHook(name, model): boolean`, and the 8 registration methods `creating`/`created`/`updating`/`updated`/`saving`/`saved`/`deleting`/`deleted`. `save()`/`delete()`'s existing `boolean` return type gains a new reachable meaning: `false` now also means "cancelled by a hook." Used by Task 2 (`SoftDeletes.ts` calls `fireHook`/`registerHook` for `restoring`/`restored`).

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lifecycle-hooks.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/lifecycle-hooks.test.ts`
Expected: FAIL — `this.creating is not a function` (thrown when the first `static { }` block runs at class-definition time)

- [ ] **Step 3: Write minimal implementation**

In `src/core/database/Model.ts`, add the `HookCallback` type immediately after the existing `ScopeCallback` type (after line 10, `export type ScopeCallback = (query: QueryBuilder, ...args: any[]) => void;`):

```ts
export type HookCallback = (model: Model) => boolean | void;
```

In the same file, insert this block immediately after the `getGlobalScopes()` method (i.e. after its closing `}`, before the `getTable()` method's doc comment):

```ts
  private static hooksRegistry = new WeakMap<typeof Model, Map<string, HookCallback[]>>();

  /**
   * Register a lifecycle hook callback on this model class. Multiple
   * callbacks can share a hook name; they run in registration order.
   */
  public static registerHook(name: string, callback: HookCallback): void {
    if (!Model.hooksRegistry.has(this)) {
      Model.hooksRegistry.set(this, new Map());
    }
    const hooks = Model.hooksRegistry.get(this)!;
    if (!hooks.has(name)) {
      hooks.set(name, []);
    }
    hooks.get(name)!.push(callback);
  }

  /**
   * Run every callback registered for a hook name against the given model.
   * Returns false the instant a callback returns false (cancelling
   * whatever operation is calling this), otherwise true.
   */
  public static fireHook(name: string, model: Model): boolean {
    const callbacks = Model.hooksRegistry.get(this)?.get(name);
    if (!callbacks) {
      return true;
    }
    for (const callback of callbacks) {
      if (callback(model) === false) {
        return false;
      }
    }
    return true;
  }

  /**
   * Register a callback that runs before a new record is inserted
   */
  public static creating(callback: HookCallback): void {
    this.registerHook("creating", callback);
  }

  /**
   * Register a callback that runs after a new record is inserted
   */
  public static created(callback: HookCallback): void {
    this.registerHook("created", callback);
  }

  /**
   * Register a callback that runs before an existing record is updated
   */
  public static updating(callback: HookCallback): void {
    this.registerHook("updating", callback);
  }

  /**
   * Register a callback that runs after an existing record is updated
   */
  public static updated(callback: HookCallback): void {
    this.registerHook("updated", callback);
  }

  /**
   * Register a callback that runs before a record is saved (insert or update)
   */
  public static saving(callback: HookCallback): void {
    this.registerHook("saving", callback);
  }

  /**
   * Register a callback that runs after a record is saved (insert or update)
   */
  public static saved(callback: HookCallback): void {
    this.registerHook("saved", callback);
  }

  /**
   * Register a callback that runs before a record is deleted
   */
  public static deleting(callback: HookCallback): void {
    this.registerHook("deleting", callback);
  }

  /**
   * Register a callback that runs after a record is deleted
   */
  public static deleted(callback: HookCallback): void {
    this.registerHook("deleted", callback);
  }

```

Replace the entire `save()` method body with:

```ts
  public save(): boolean {
    const constructor = this.constructor as typeof Model;

    if (!constructor.fireHook("saving", this)) {
      return false;
    }

    if (this.exists) {
      // Update existing record
      if (!constructor.fireHook("updating", this)) {
        return false;
      }
      const id = this.attributes[this.primaryKey];
      const changes = this.getDirty();
      if (Object.keys(changes).length > 0) {
        constructor.query().where(this.primaryKey, "=", id).update(changes);
        this.original = { ...this.attributes };
      }
      constructor.fireHook("updated", this);
    } else {
      // Insert new record
      if (!constructor.fireHook("creating", this)) {
        return false;
      }
      const id = constructor.query().insert(this.attributes);
      this.attributes[this.primaryKey] = id;
      this.original = { ...this.attributes };
      this.exists = true;
      constructor.fireHook("created", this);
    }

    constructor.fireHook("saved", this);
    return true;
  }
```

Replace the entire `delete()` method body with:

```ts
  public delete(): boolean {
    if (!this.exists) {
      return false;
    }

    const constructor = this.constructor as typeof Model;

    if (!constructor.fireHook("deleting", this)) {
      return false;
    }

    const id = this.attributes[this.primaryKey];
    constructor.query().where(this.primaryKey, "=", id).delete();
    this.exists = false;
    constructor.fireHook("deleted", this);

    return true;
  }
```

In `src/index.ts`, find this existing line:

```ts
export type { ScopeCallback } from "./core/database/Model";
```

Replace it with:

```ts
export type { ScopeCallback, HookCallback } from "./core/database/Model";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/lifecycle-hooks.test.ts`
Expected: `10 pass, 0 fail`

- [ ] **Step 5: Run the full suite to check for regressions**

`save()`/`delete()` are used throughout the codebase (`AuthController`, every model test, relations, soft-deletes) — this is the one feature so far that modifies existing, heavily-used control flow, so the full-suite run here matters more than usual.

Run: `bun test`
Expected: `446 pass, 0 fail` (436 existing + 10 new)

- [ ] **Step 6: Commit**

```bash
git add src/core/database/Model.ts src/index.ts tests/unit/lifecycle-hooks.test.ts
git commit -m "feat(database): add model lifecycle hooks"
```

---

### Task 2: `SoftDeletes` hooks (`restoring`/`restored` + `deleting`/`deleted` re-dispatch)

**Files:**
- Modify: `src/core/database/SoftDeletes.ts` (targeted method-body replacements + two new methods)
- Modify: `tests/unit/lifecycle-hooks.test.ts` (append)

**Interfaces:**
- Consumes: `HookCallback`, `Model.registerHook`, `Model.fireHook` (Task 1).
- Produces: `SoftDeletes`-mixed models gain `restoring`/`restored(callback: HookCallback): void`; soft `delete()` now fires `deleting`/`deleted`; `restore()` fires `restoring`/`restored`.

- [ ] **Step 1: Write the failing tests**

Add this import to the top of `tests/unit/lifecycle-hooks.test.ts`, alongside the existing ones:

```ts
import { SoftDeletes } from "../../src/core/database/SoftDeletes";
```

Append this describe block at the end of the file:

```ts
describe("SoftDeletes Lifecycle Hooks", () => {
  let connection: DatabaseConnection;

  beforeAll(async () => {
    connection = new DatabaseConnection({ driver: "sqlite", connection: { filename: ":memory:" } });
    connection.connect();
    Model.setConnection(connection);
    Schema.setConnection(connection);

    await Schema.create("hook_test_posts", (table) => {
      table.id();
      table.string("title");
      table.string("deleted_at").nullable();
    });
  });

  afterAll(() => {
    connection.close();
  });

  test("soft delete() fires deleting/deleted", () => {
    const calls: string[] = [];
    class TestPost extends SoftDeletes(Model) {
      static override tableName = "hook_test_posts";
      static {
        this.deleting(() => {
          calls.push("deleting");
        });
        this.deleted(() => {
          calls.push("deleted");
        });
      }
    }

    const post = new TestPost();
    post.fill({ title: "ToSoftDelete" }).save();
    post.delete();

    expect(calls).toEqual(["deleting", "deleted"]);
    expect(post.trashed()).toBe(true);
  });

  test("returning false from deleting cancels a soft delete", () => {
    class TestPost extends SoftDeletes(Model) {
      static override tableName = "hook_test_posts";
      static {
        this.deleting(() => false);
      }
    }

    const post = new TestPost();
    post.fill({ title: "Protected" }).save();
    const result = post.delete();

    expect(result).toBe(false);
    expect(post.trashed()).toBe(false);
  });

  test("restore() fires restoring/restored", () => {
    const calls: string[] = [];
    class TestPost extends SoftDeletes(Model) {
      static override tableName = "hook_test_posts";
      static {
        this.restoring(() => {
          calls.push("restoring");
        });
        this.restored(() => {
          calls.push("restored");
        });
      }
    }

    const post = new TestPost();
    post.fill({ title: "ToRestore" }).save();
    post.delete();
    post.restore();

    expect(calls).toEqual(["restoring", "restored"]);
    expect(post.trashed()).toBe(false);
  });

  test("returning false from restoring cancels the restore", () => {
    class TestPost extends SoftDeletes(Model) {
      static override tableName = "hook_test_posts";
      static {
        this.restoring(() => false);
      }
    }

    const post = new TestPost();
    post.fill({ title: "StaysTrashed" }).save();
    post.delete();

    const result = post.restore();

    expect(result).toBe(false);
    expect(post.trashed()).toBe(true);
  });

  test("forceDelete() fires deleting/deleted via the super.delete() passthrough", () => {
    const calls: string[] = [];
    class TestPost extends SoftDeletes(Model) {
      static override tableName = "hook_test_posts";
      static {
        this.deleting(() => {
          calls.push("deleting");
        });
        this.deleted(() => {
          calls.push("deleted");
        });
      }
    }

    const post = new TestPost();
    post.fill({ title: "ToForceDelete" }).save();
    const id = post.get("id");
    post.forceDelete();

    expect(calls).toEqual(["deleting", "deleted"]);
    expect(TestPost.withTrashed().find(id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/lifecycle-hooks.test.ts`
Expected: FAIL — `this.deleting is not a function` on the first `TestPost` class's `static { }` block (`deleting`/`deleted`/`restoring`/`restored` don't exist on `SoftDeletes`-mixed classes yet)

- [ ] **Step 3: Write minimal implementation**

In `src/core/database/SoftDeletes.ts`, change the import line at the top from:

```ts
import type { Model } from "./Model";
```

to:

```ts
import type { Model, HookCallback } from "./Model";
```

Replace the `delete()` method body with:

```ts
    /**
     * Mark this record as deleted without removing it from the database
     */
    public override delete(): boolean {
      if (!this.exists) {
        return false;
      }
      const constructor = this.constructor as typeof Model;
      if (!constructor.fireHook("deleting", this)) {
        return false;
      }
      this.set("deleted_at", new Date().toISOString());
      const saved = this.save();
      if (saved) {
        constructor.fireHook("deleted", this);
      }
      return saved;
    }
```

Replace the `restore()` method body with:

```ts
    /**
     * Restore a soft-deleted record
     */
    public restore(): boolean {
      const constructor = this.constructor as typeof Model;
      if (!constructor.fireHook("restoring", this)) {
        return false;
      }
      this.set("deleted_at", null);
      const saved = this.save();
      if (saved) {
        constructor.fireHook("restored", this);
      }
      return saved;
    }
```

Add these two methods immediately after `onlyTrashed()` (i.e. after its closing `}`, before the mixin's returned class's closing `};`):

```ts

    /**
     * Register a callback that runs before a soft-deleted record is restored
     */
    public static restoring(callback: HookCallback): void {
      this.registerHook("restoring", callback);
    }

    /**
     * Register a callback that runs after a soft-deleted record is restored
     */
    public static restored(callback: HookCallback): void {
      this.registerHook("restored", callback);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/lifecycle-hooks.test.ts`
Expected: `15 pass, 0 fail` (10 from Task 1 + 5 new)

- [ ] **Step 5: Run the full suite**

Run: `bun test`
Expected: `451 pass, 0 fail` (446 after Task 1 + 5 new)

- [ ] **Step 6: Commit**

```bash
git add src/core/database/SoftDeletes.ts tests/unit/lifecycle-hooks.test.ts
git commit -m "feat(database): add restoring/restored hooks and deleting/deleted re-dispatch to SoftDeletes"
```

---

## Self-Review Notes

- **Spec coverage:** `HookCallback` type + registry + 8 registration methods + `save()`/`delete()` hook-firing (Task 1), `SoftDeletes`'s `deleting`/`deleted` re-dispatch + `restoring`/`restored` (Task 2), `HookCallback` barrel export (folded into Task 1) — every component in the spec has a task.
- **Non-goals respected:** no `Model.create()`/`updateWhere()`/`deleteWhere()` changes anywhere in this plan; hooks stay fully synchronous (no `async` in `HookCallback`'s signature, no changes to `save()`/`delete()`'s sync return types beyond the pre-existing `boolean`); no routing through `EventDispatcher`; no `forceDeleting`/`forceDeleted` distinct names (Task 2's test explicitly proves `forceDelete()` reuses `deleting`/`deleted` via the `super.delete()` passthrough, with zero extra code needed for that case — matching the spec's stated design exactly).
- **Cancellation semantics checked against the spec:** only `creating`/`updating`/`saving`/`deleting`/`restoring` (the "ing" hooks) can return `false` to cancel, checked via strict `=== false` in `fireHook`; `created`/`updated`/`saved`/`deleted`/`restored` never gate anything in either `save()`/`delete()` or `SoftDeletes`'s overrides — verified by re-reading every call site inserted in Task 1 Step 3 and Task 2 Step 3.
- **Test isolation:** every test in both new describe blocks defines its own model class inline (not shared module-level state) specifically to avoid hook-registry cross-contamination between tests — called out explicitly in Global Constraints, not left implicit.
