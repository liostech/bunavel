# Soft Deletes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Laravel-style soft deletes via a `SoftDeletes(Model)` mixin — models that opt in get `delete()` that marks instead of removes, `restore()`, `forceDelete()`, `trashed()`, and `withTrashed()`/`onlyTrashed()` query helpers, with a `deleted_at IS NULL` global scope auto-hiding soft-deleted rows.

**Architecture:** `SoftDeletes<TBase extends typeof Model>(Base: TBase)` returns a class extending `Base`. It overrides `static query()` to lazily register the `"softDelete"` global scope the first time `query()` runs on the actual leaf class (a normal method call, so `this` correctly resolves to e.g. `Post`, not the mixin's own intermediate class — sidesteps the `this`-binding problem a `static {}` block would have). `withTrashed()`/`onlyTrashed()` are thin wrappers over the already-shipped `QueryBuilder.withoutGlobalScope()`.

**Tech Stack:** Bun, TypeScript, `bun:test`, the existing `Model`/`QueryBuilder`/`Schema`/`DatabaseConnection` classes and the query-scopes global-scope mechanism (already shipped on `main`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-soft-deletes-design.md` — read it if anything below is ambiguous.
- Run the full suite with `bun test` (currently 428 pass / 0 fail — must stay green after every task).
- `verbatimModuleSyntax` is enabled in `tsconfig.json` — any import used only as a type MUST use `import type { X }`. `Model` and `QueryBuilder` are used only in type positions in the new `SoftDeletes.ts` file (the actual `Model` value is supplied by the caller as the `Base` parameter; query building is always delegated to `super.query()`/`this.query()`) — both must be `import type`.
- The soft-delete column is fixed as `deleted_at` — not configurable in this plan (see spec's Non-goals).
- No changes to `Model.ts` or `QueryBuilder.ts` in this plan — the whole feature is additive, in one new file.
- `QueryBuilder.find()`/`.first()` return `undefined` when no row matches (raw `bun:sqlite` `stmt.get()` behavior) — NOT `null`. `Model.find()` explicitly converts that to `null`. Use `.toBeTruthy()`/`.toBeUndefined()` for assertions against `QueryBuilder`-returned results (e.g. `withTrashed().find(id)`), and `.toBeNull()`/`.toBeTruthy()` only for `Model.find()`-returned results (e.g. plain `SoftDeleteTestPost.find(id)`) — mixing these up produces a test that passes for the wrong reason.
- `noImplicitOverride: true` — the mixin's `query()` and `delete()` overrides both override *concrete* (non-abstract) `Model` methods, so both need the `override` keyword (unlike `AuthMiddleware.handle`, which implements an abstract member and needs no `override`).

---

## File Structure

New files:
- `src/core/database/SoftDeletes.ts` — the mixin function
- `tests/unit/soft-deletes.test.ts`

Modified files:
- `src/index.ts` — export `SoftDeletes`

---

### Task 1: `SoftDeletes` mixin

**Files:**
- Create: `src/core/database/SoftDeletes.ts`
- Create: `tests/unit/soft-deletes.test.ts`

**Interfaces:**
- Consumes: `Model.addGlobalScope(name, callback)`, `QueryBuilder.withoutGlobalScope(name)`, `QueryBuilder.whereNull(column)`/`whereNotNull(column)` — all already shipped on `main` (query-scopes and the original `QueryBuilder`).
- Produces: `SoftDeletes<TBase extends typeof Model>(Base: TBase)` returning a class with `delete()` (overridden), `forceDelete()`, `restore()`, `trashed()` (instance methods) and `query()` (overridden), `withTrashed()`, `onlyTrashed()` (static methods). Used by Task 2's barrel export and by any future model wanting soft deletes.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/soft-deletes.test.ts`:

```ts
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

    expect(SoftDeleteTestPost.withTrashed().find(id)).toBeUndefined();
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/soft-deletes.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/database/SoftDeletes'`

- [ ] **Step 3: Write minimal implementation**

Create `src/core/database/SoftDeletes.ts`:

```ts
import type { Model } from "./Model";
import type { QueryBuilder } from "./QueryBuilder";

/**
 * Mixin that adds soft-delete behavior to a Model subclass: delete() marks
 * a row as deleted (sets deleted_at) instead of removing it, with a global
 * scope hiding soft-deleted rows from normal queries until opted back in
 * via withTrashed()/onlyTrashed().
 *
 * The global scope is registered lazily, the first time query() runs on
 * the actual leaf class (not eagerly in a static {} block here) — a
 * static {} block written in this file would bind `this` to this mixin's
 * own intermediate class, not the caller's leaf class (e.g. Post), and
 * would register the scope under the wrong key in Model's already-shipped
 * per-class scope registry. A normal method call correctly resolves `this`
 * to the actual leaf class via standard late static binding.
 */
export function SoftDeletes<TBase extends typeof Model>(Base: TBase) {
  return class extends Base {
    private static softDeleteScopeRegistered = false;

    public static override query(): QueryBuilder {
      if (!this.softDeleteScopeRegistered) {
        this.softDeleteScopeRegistered = true;
        this.addGlobalScope("softDelete", (query) => query.whereNull("deleted_at"));
      }
      return super.query();
    }

    /**
     * Mark this record as deleted without removing it from the database
     */
    public override delete(): boolean {
      if (!this.exists) {
        return false;
      }
      this.set("deleted_at", new Date().toISOString());
      return this.save();
    }

    /**
     * Permanently remove this record from the database
     */
    public forceDelete(): boolean {
      return super.delete();
    }

    /**
     * Restore a soft-deleted record
     */
    public restore(): boolean {
      this.set("deleted_at", null);
      return this.save();
    }

    /**
     * Check whether this record is soft-deleted
     */
    public trashed(): boolean {
      return this.get("deleted_at") != null;
    }

    /**
     * Query including soft-deleted records
     */
    public static withTrashed(): QueryBuilder {
      return this.query().withoutGlobalScope("softDelete");
    }

    /**
     * Query only soft-deleted records
     */
    public static onlyTrashed(): QueryBuilder {
      return this.query().withoutGlobalScope("softDelete").whereNotNull("deleted_at");
    }
  };
}
```

If `bun test` fails to even load this file with a TypeScript-generics-related error referencing the `TBase extends typeof Model` constraint (as opposed to a normal assertion failure), try changing the constraint to `TBase extends abstract new (...args: any[]) => Model` instead (`Model` is an abstract class, and some TypeScript versions need this more explicit constructor-signature form for `class extends Base {}` to resolve inside a generic function). This project has no `tsc`-based CI gate — `bun test` passing is the actual bar; don't spend time chasing a pure `tsc --noEmit` complaint that doesn't affect `bun test`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/soft-deletes.test.ts`
Expected: `7 pass, 0 fail`

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `bun test`
Expected: `435 pass, 0 fail` (428 existing + 7 new)

- [ ] **Step 6: Commit**

```bash
git add src/core/database/SoftDeletes.ts tests/unit/soft-deletes.test.ts
git commit -m "feat(database): add SoftDeletes mixin"
```

---

### Task 2: Barrel export

**Files:**
- Modify: `src/index.ts`
- Modify: `tests/unit/soft-deletes.test.ts` (append)

**Interfaces:**
- Consumes: `SoftDeletes` (Task 1).
- Produces: public package export — last task, no downstream consumers within this plan.

- [ ] **Step 1: Write the failing test**

Append this describe block at the end of `tests/unit/soft-deletes.test.ts`:

```ts
describe("src/index.ts barrel exports", () => {
  test("exports SoftDeletes", async () => {
    const barrel = await import("../../src/index");
    expect(typeof barrel.SoftDeletes).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/soft-deletes.test.ts`
Expected: FAIL — `barrel.SoftDeletes` is `undefined`, `expect(typeof barrel.SoftDeletes).toBe("function")` fails

- [ ] **Step 3: Write minimal implementation**

In `src/index.ts`, find this existing line:

```ts
export { Model } from "./core/database/Model";
export type { ScopeCallback } from "./core/database/Model";
```

Add a new line immediately after it:

```ts
export { Model } from "./core/database/Model";
export type { ScopeCallback } from "./core/database/Model";
export { SoftDeletes } from "./core/database/SoftDeletes";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/unit/soft-deletes.test.ts`
Expected: `8 pass, 0 fail` (7 from Task 1 + 1 new)

- [ ] **Step 5: Run the full suite**

Run: `bun test`
Expected: `436 pass, 0 fail` (435 after Task 1 + 1 new)

- [ ] **Step 6: Commit**

```bash
git add src/index.ts tests/unit/soft-deletes.test.ts
git commit -m "feat(database): export SoftDeletes from src/index.ts"
```

---

## Self-Review Notes

- **Spec coverage:** the mixin's `query()` lazy-registration, `delete()`/`forceDelete()`/`restore()`/`trashed()` instance methods, `withTrashed()`/`onlyTrashed()` static methods (Task 1), barrel export (Task 2) — every component in the spec has a task.
- **Non-goals respected:** `deleted_at` is hardcoded, not configurable; no cascading deletes; no changes to `Model.ts`/`QueryBuilder.ts` anywhere in this plan (confirmed by File Structure listing only new/barrel files).
- **Type consistency checked:** `SoftDeletes<TBase extends typeof Model>(Base: TBase)`'s returned class's `query()`/`withTrashed()`/`onlyTrashed()` all return `QueryBuilder`, matching `Model.query()`'s existing return type exactly (no narrower/wider type introduced).
- **`undefined`-vs-`null` pitfall avoided:** every test assertion against a `QueryBuilder`-returned result (`withTrashed().find(id)`) uses `toBeTruthy()`/`toBeUndefined()`; every assertion against a `Model.find()`-returned result uses `toBeNull()`/`toBeTruthy()` — verified against the actual `QueryBuilder.first()`/`Model.find()` source before writing this plan, not assumed.
