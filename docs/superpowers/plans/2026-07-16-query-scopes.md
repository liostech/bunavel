# Query Scopes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local and global query scopes to Bunavel's `Model`/`QueryBuilder` — reusable, chainable, named query filters, with global scopes auto-applying to every read until explicitly opted out.

**Architecture:** `Model` gains two `WeakMap<typeof Model, Map<string, ScopeCallback>>` registries (local, global), keyed by the actual calling subclass so scopes never leak between models. `QueryBuilder.scope(name, ...args)` looks up and invokes a local scope immediately. Global scopes apply lazily — once, inside `buildSelectQuery()` — so `withoutGlobalScope()`/`withoutGlobalScopes()` can mark exclusions before the query ever executes.

**Tech Stack:** Bun, TypeScript, `bun:test`, the existing `Model`/`QueryBuilder`/`Schema`/`DatabaseConnection` classes.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-query-scopes-design.md` — read it if anything below is ambiguous.
- Run the full suite with `bun test` (currently 416 pass / 0 fail — must stay green after every task).
- `verbatimModuleSyntax` is enabled in `tsconfig.json` — any import used only as a type MUST use `import type { X }`.
- Boolean-like columns in this codebase's tests are stored as `INTEGER` (`0`/`1`), never as native JS `true`/`false` bound as SQL parameters — `bun:sqlite` only accepts number/string/bigint/buffer/null as bind values, not booleans (confirmed via `tests/unit/query-builder.test.ts`, which uses `active INTEGER DEFAULT 1` and `.update({ active: 0 })`, never a literal `true`/`false`). Follow this convention in every new test.
- No existing model, test, or query-builder call site needs to change — this is purely additive.
- `update()`/`delete()` on `QueryBuilder` are NOT touched by this plan (they build SQL independently of `buildSelectQuery()`) — global scopes apply only to reads, per the spec's Non-goals.

---

## File Structure

Modified files:
- `src/core/database/Model.ts` — add `ScopeCallback` type, `localScopesRegistry`/`globalScopesRegistry` (both `WeakMap`-keyed by class), `addScope`/`getScope`, `addGlobalScope`/`getGlobalScopes`
- `src/core/database/QueryBuilder.ts` — add `scope()`, `withoutGlobalScope()`, `withoutGlobalScopes()`, the private scope-tracking state, and the apply-once step at the top of `buildSelectQuery()`
- `src/index.ts` — export `ScopeCallback` (type-only; added in Task 1 alongside its definition, no dedicated barrel task — see the note in Task 1)

New files:
- `tests/unit/scopes.test.ts` — built up across both tasks

Note on scope: a dedicated "barrel exports" task (used in the two prior plans for this project) isn't included here. Those plans exported real runtime *values* (classes) that a `typeof barrel.X === "function"` test could meaningfully RED/GREEN. `ScopeCallback` is a type-only export, erased entirely at runtime by Bun's transpiler — `bun test` cannot fail on a missing `export type` (both the export line and the test's `import type` are erased before the code ever runs, whether or not the line exists), so there is no bun:test-based RED state to demonstrate for it. The export line is added as part of Task 1 without a dedicated test step, since inventing a test that can't actually fail would violate the "no placeholders" / real-verification principle this project follows.

---

### Task 1: Local scopes

**Files:**
- Modify: `src/core/database/Model.ts` (targeted insert, not a full-file rewrite)
- Modify: `src/core/database/QueryBuilder.ts` (targeted insert)
- Modify: `src/index.ts` (one new export line)
- Create: `tests/unit/scopes.test.ts`

**Interfaces:**
- Produces: `ScopeCallback = (query: QueryBuilder, ...args: any[]) => void`, `Model.addScope(name, callback): void`, `Model.getScope(name): ScopeCallback | undefined`, `QueryBuilder.scope(name, ...args): this`. Used by Task 2's global-scope tests (which also exercise local scopes combined with global ones) and by any future model that wants reusable filters.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/scopes.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/scopes.test.ts`
Expected: FAIL — `this.addScope is not a function` (thrown when the `static { }` block runs at class-definition time, so the whole file fails to load)

- [ ] **Step 3: Write minimal implementation**

In `src/core/database/Model.ts`, add the `ScopeCallback` type right after the existing imports (after `import { BelongsToMany } from "./relations/BelongsToMany";`, before `export abstract class Model {`):

```ts
export type ScopeCallback = (query: QueryBuilder, ...args: any[]) => void;
```

In the same file, insert this block immediately after the `setConnection` method (i.e. after its closing `}`, before the `getTable` method's doc comment):

```ts
  private static localScopesRegistry = new WeakMap<typeof Model, Map<string, ScopeCallback>>();

  /**
   * Register a named local scope on this model class
   */
  public static addScope(name: string, callback: ScopeCallback): void {
    if (!Model.localScopesRegistry.has(this)) {
      Model.localScopesRegistry.set(this, new Map());
    }
    Model.localScopesRegistry.get(this)!.set(name, callback);
  }

  /**
   * Get a named local scope registered on this model class
   */
  public static getScope(name: string): ScopeCallback | undefined {
    return Model.localScopesRegistry.get(this)?.get(name);
  }

```

In `src/core/database/QueryBuilder.ts`, insert this method immediately after `getEagerLoadRelations()` (i.e. after its closing `}`, before the `buildSelectQuery` method's doc comment):

```ts
  /**
   * Apply a named local scope registered on the query's model
   */
  public scope(name: string, ...args: any[]): this {
    if (!this.modelClass) {
      throw new Error(`Cannot apply scope "${name}": no model is associated with this query.`);
    }
    const callback = this.modelClass.getScope(name);
    if (!callback) {
      throw new Error(`Scope "${name}" is not defined on ${this.modelClass.name}.`);
    }
    callback(this, ...args);
    return this;
  }

```

In `src/index.ts`, find this existing line:

```ts
export { Model } from "./core/database/Model";
```

Add a new line immediately after it:

```ts
export { Model } from "./core/database/Model";
export type { ScopeCallback } from "./core/database/Model";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/scopes.test.ts`
Expected: `5 pass, 0 fail`

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `bun test`
Expected: `421 pass, 0 fail` (416 existing + 5 new)

- [ ] **Step 6: Commit**

```bash
git add src/core/database/Model.ts src/core/database/QueryBuilder.ts src/index.ts tests/unit/scopes.test.ts
git commit -m "feat(database): add local query scopes"
```

---

### Task 2: Global scopes

**Files:**
- Modify: `src/core/database/Model.ts` (targeted insert)
- Modify: `src/core/database/QueryBuilder.ts` (targeted insert + one-line change to `buildSelectQuery()`)
- Modify: `tests/unit/scopes.test.ts` (append)

**Interfaces:**
- Consumes: `ScopeCallback` (Task 1).
- Produces: `Model.addGlobalScope(name, callback): void`, `Model.getGlobalScopes(): Map<string, ScopeCallback>`, `QueryBuilder.withoutGlobalScope(name): this`, `QueryBuilder.withoutGlobalScopes(): this`. `buildSelectQuery()` now applies registered global scopes (minus any excluded ones) exactly once per `QueryBuilder` instance, before building SQL.

- [ ] **Step 1: Write the failing tests**

Append this describe block at the end of `tests/unit/scopes.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/scopes.test.ts`
Expected: FAIL — `this.addGlobalScope is not a function` (thrown when `GlobalScopeTestUser`'s `static { }` block runs at class-definition time)

- [ ] **Step 3: Write minimal implementation**

In `src/core/database/Model.ts`, insert this block immediately after the `getScope` method added in Task 1 (i.e. after its closing `}`, before the `query()` method's doc comment):

```ts
  private static globalScopesRegistry = new WeakMap<typeof Model, Map<string, ScopeCallback>>();

  /**
   * Register a named global scope on this model class, auto-applied to
   * every read query until explicitly opted out via withoutGlobalScope()
   */
  public static addGlobalScope(name: string, callback: ScopeCallback): void {
    if (!Model.globalScopesRegistry.has(this)) {
      Model.globalScopesRegistry.set(this, new Map());
    }
    Model.globalScopesRegistry.get(this)!.set(name, callback);
  }

  /**
   * Get all global scopes registered on this model class
   */
  public static getGlobalScopes(): Map<string, ScopeCallback> {
    return Model.globalScopesRegistry.get(this) ?? new Map();
  }

```

In `src/core/database/QueryBuilder.ts`, add three new private fields immediately after the existing `private modelClass?: typeof Model;` field declaration:

```ts
  private modelClass?: typeof Model;
  private globalScopesApplied: boolean = false;
  private removedGlobalScopeNames: Set<string> = new Set();
  private allGlobalScopesRemoved: boolean = false;
```

(This replaces the single existing `private modelClass?: typeof Model;` line with the four lines above.)

Insert these methods immediately after the `scope()` method added in Task 1 (i.e. after its closing `}`, before the `buildSelectQuery` method's doc comment):

```ts
  /**
   * Exclude a specific global scope from this query
   */
  public withoutGlobalScope(name: string): this {
    this.removedGlobalScopeNames.add(name);
    return this;
  }

  /**
   * Exclude all global scopes from this query
   */
  public withoutGlobalScopes(): this {
    this.allGlobalScopesRemoved = true;
    return this;
  }

  /**
   * Apply the model's registered global scopes to this query, once
   */
  private applyGlobalScopes(): void {
    if (this.globalScopesApplied || !this.modelClass || this.allGlobalScopesRemoved) {
      this.globalScopesApplied = true;
      return;
    }
    this.globalScopesApplied = true;

    const scopes = this.modelClass.getGlobalScopes();
    for (const [name, callback] of scopes) {
      if (!this.removedGlobalScopeNames.has(name)) {
        callback(this);
      }
    }
  }

```

Finally, change the `buildSelectQuery()` method to call `applyGlobalScopes()` first. Change:

```ts
  private buildSelectQuery(): { sql: string; params: any[] } {
    let sql = `SELECT ${this.selectColumns.join(", ")} FROM ${this.tableName}`;
```

to:

```ts
  private buildSelectQuery(): { sql: string; params: any[] } {
    this.applyGlobalScopes();
    let sql = `SELECT ${this.selectColumns.join(", ")} FROM ${this.tableName}`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/scopes.test.ts`
Expected: `11 pass, 0 fail` (5 from Task 1 + 6 new)

- [ ] **Step 5: Run the full suite**

Run: `bun test`
Expected: `427 pass, 0 fail` (421 after Task 1 + 6 new)

- [ ] **Step 6: Commit**

```bash
git add src/core/database/Model.ts src/core/database/QueryBuilder.ts tests/unit/scopes.test.ts
git commit -m "feat(database): add global query scopes with opt-out"
```

---

## Self-Review Notes

- **Spec coverage:** `ScopeCallback` type + local-scope registry/lookup/invocation (Task 1), global-scope registry + lazy apply-once + `withoutGlobalScope`/`withoutGlobalScopes` (Task 2) — every component in the spec has a task. `ScopeCallback` barrel export is folded into Task 1 (see the File Structure note on why it has no dedicated task/test).
- **Non-goals respected:** no `Proxy`/magic scope methods anywhere in this plan; `update()`/`delete()` are never touched; no `booted()`-style lifecycle hook introduced — registration is a plain `static { }` block or a direct `Model.addScope(...)` call, both already-legal JS/TS with no new framework machinery.
- **Type consistency checked:** `ScopeCallback`'s signature (`(query: QueryBuilder, ...args: any[]) => void`) is used identically by `addScope`/`getScope`/`addGlobalScope`/`getGlobalScopes` in `Model.ts` and by the callback invocation in `QueryBuilder.scope()`/`applyGlobalScopes()`. `WeakMap<typeof Model, Map<string, ScopeCallback>>` is the same shape for both the local and global registries.
- **Boolean/SQLite pitfall avoided:** every test in this plan uses `INTEGER` columns with `0`/`1` values, matching the codebase's established convention (`bun:sqlite` rejects native JS booleans as bind parameters) — verified against `tests/unit/query-builder.test.ts` before writing this plan, not assumed.
