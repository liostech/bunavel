# Query Scopes — Design

## Summary

Add Laravel-style local and global query scopes to Bunavel's `Model`/`QueryBuilder`:
reusable, named, chainable query filters (`local` scopes, invoked explicitly per
query) and filters that auto-apply to every query for a model until opted out
(`global` scopes). Third of the remaining Laravel-parity features (route groups →
**query scopes** → soft deletes → model lifecycle hooks → sessions → API
resources) — soft deletes will be built as a global scope on top of this.

## Non-goals

- **Magic scope methods** (`User.active()` / `User::active()`-style dynamic
  dispatch). Explored and explicitly rejected: making this work requires either
  proxying every `QueryBuilder` instance or proxying `Model` itself as a base
  class, and either way TypeScript cannot see dynamically-added methods —
  scope names lose compile-time checking, autocomplete, and "go to
  definition." This codebase has no `Proxy`/`Reflect` usage anywhere; the
  explicit `.scope("name")` call site is the deliberate trade-off.
- **Scope parameters with static typing per name** (e.g. `scope<"olderThan">(name, age: number)`).
  `scope(name: string, ...args: any[])` is untyped past the name — matches
  the same level of type-looseness `Model.where(column: string, ...)` already
  has in this codebase.
- **Global scopes applying to `update()`/`delete()`.** Only `buildSelectQuery()`-based
  reads (`get`, `first`, `count`, `paginate`, and anything built on them like
  `find`) are affected. Instance-level `Model.save()`/`Model.delete()` already
  target a known row by primary key and don't need a visibility filter.
- **Scope discovery/introspection APIs** (listing registered scope names,
  etc.) — not requested, add if a real use case shows up.
- **A `booted()`-style lifecycle hook for registration.** Scopes are
  registered via a `static { }` initializer block in the class body (ES2022,
  already supported by this project's `"target": "ESNext"` tsconfig) — no new
  lifecycle-hook system. A `booted()`-style Model lifecycle system is a
  separate, later planned feature (model lifecycle hooks).

## API

### Local scopes

```ts
class User extends Model {
  static tableName = "users";

  static {
    this.addScope("active", (query) => query.where("active", true));
    this.addScope("olderThan", (query, age: number) => query.where("age", ">", age));
  }
}

User.query().scope("active").scope("olderThan", 18).get();
```

- `Model.addScope(name: string, callback: ScopeCallback): void` — registers a
  named scope on the calling class (i.e. `this` inside the static method,
  which is whichever subclass the `static { }` block belongs to).
- `QueryBuilder.scope(name: string, ...args: any[]): this` — looks up the
  scope on the query's associated model class and invokes
  `callback(this, ...args)`. Throws `` Error(`Scope "${name}" is not defined on ${modelName}.`) ``
  for an unregistered name — same "plain descriptive `Error`" convention
  already used by `router.route()` (unknown name) and `Container.make()`
  (unbound key).
- `ScopeCallback = (query: QueryBuilder, ...args: any[]) => void` — the
  callback mutates the passed `query` via its existing chainable methods
  (`.where()`, `.whereIn()`, etc.); the return value is ignored, matching how
  Laravel scope closures mutate `$query` by reference without needing to
  return it.

### Global scopes

```ts
class User extends Model {
  static {
    this.addGlobalScope("active", (query) => query.where("active", true));
  }
}

User.all();                                    // active users only
User.query().withoutGlobalScope("active").get(); // all users, this scope skipped
User.query().withoutGlobalScopes().get();        // all users, every global scope skipped
```

- `Model.addGlobalScope(name: string, callback: ScopeCallback): void` —
  same registration shape as `addScope`, separate registry.
- `QueryBuilder.withoutGlobalScope(name: string): this` / `withoutGlobalScopes(): this` —
  mark scopes as excluded for this query. Must be called before the query
  executes (see Execution model below) — calling it after `get()`/`first()`/
  `count()`/`paginate()` has already run on the same builder has no effect,
  since the scope's `where()` clause is already baked into
  `whereConditions` by then. This is an accepted, documented limitation, not
  a bug to guard against — nothing in this codebase calls a terminal method
  and then keeps building the same query afterward.

### Per-class isolation

Both registries live on the shared base `Model` class as
`WeakMap<typeof Model, Map<string, ScopeCallback>>`, keyed by the actual
calling subclass (`this` at registration time). This avoids the classic
static-inheritance-aliasing bug — if scopes were stored in a plain
`static scopes = new Map()` field on `Model` without this indirection, every
subclass that doesn't shadow the field would share the *same* `Map` instance
(JS static fields are inherited by reference through the prototype chain),
so `User`'s scopes would leak into `Post`. The `WeakMap`-keyed-by-class
pattern keys correctly per subclass regardless of whether the subclass
redeclares anything.

## Execution model

Global scopes apply lazily, exactly once per `QueryBuilder` instance, inside
`buildSelectQuery()` — not eagerly when `Model.query()` constructs the
builder. This is the one non-obvious design decision in this feature, and
it's what makes `withoutGlobalScope()` possible at all:

- If scopes applied eagerly in `Model.query()`, the scope's `where()` clause
  would already be pushed into `whereConditions` before the caller ever gets
  a chance to call `.withoutGlobalScope()` on the returned builder — there'd
  be no way to "un-push" a specific condition after the fact, since
  `whereConditions` doesn't tag which condition came from which scope.
- Applying lazily at `buildSelectQuery()` time means every terminal read
  method (`get`, `first`, `count`, and anything built on them —
  `paginate()` via `count()` + `get()`, `find()` via `where().first()`)
  automatically respects both the model's global scopes and whatever the
  caller opted out of, regardless of entry point (`User.all()`, `User.find()`,
  `User.where()`, `User.paginate()` all end up calling a `QueryBuilder`
  method that funnels through `buildSelectQuery()`) — zero changes needed to
  `Model`'s existing static query methods.
- A `private globalScopesApplied: boolean` flag on `QueryBuilder` ensures
  scopes are only applied once even when `buildSelectQuery()` runs multiple
  times on the same instance (e.g. `paginate()` calls both `count()` and
  `get()` on itself) — without this guard, a scope's `where()` would be
  pushed twice, producing a redundant (though harmless) duplicate `AND`
  clause.
- Eager-loaded relationship queries (`relation.getRelatedQuery()` inside
  `QueryBuilder.eagerLoadRelation()`) go through the related model's own
  `.query()` → `buildSelectQuery()` path transparently, so a related model's
  global scopes apply automatically to eager-loaded results too (e.g.
  loading `user.posts()` would exclude soft-deleted posts once soft delete
  is built on top of this) — no extra work needed for this to just work.

## Error handling

- `QueryBuilder.scope(name)` with no model associated with the query (a
  `QueryBuilder` constructed directly, not via `Model.query()`) or an
  unregistered scope name → plain `Error`, uncaught by the framework — a
  programmer error, not a request-time HTTP error, matching the existing
  `Container.make()`/`router.route()` precedent.
- `QueryBuilder.withoutGlobalScope(name)` on a name that was never
  registered is a silent no-op (nothing to exclude) — matches Laravel's own
  permissive behavior here (no error for excluding a non-existent scope).

## Touches to existing code

- `src/core/database/Model.ts` — add `ScopeCallback` type, the two
  `WeakMap`-based registries, `addScope`/`getScope`, `addGlobalScope`/
  `getGlobalScopes`. No changes to any existing method.
- `src/core/database/QueryBuilder.ts` — add `scope()`, `withoutGlobalScope()`,
  `withoutGlobalScopes()`, the `globalScopesApplied`/`removedGlobalScopes`/
  `allGlobalScopesRemoved` private state, and the scope-application step at
  the top of `buildSelectQuery()`. No changes to any other existing method
  (`update()`/`delete()` build their SQL independently of
  `buildSelectQuery()` and are intentionally untouched — see Non-goals).
- `src/index.ts` — export `ScopeCallback` (type-only).

No existing model (`app/models/User.ts`) or test needs to change — this is
purely additive; nothing currently registers or relies on scopes.

## Testing

New `tests/unit/scopes.test.ts` (real in-memory SQLite + `Schema`, matching
the pattern already used by `tests/unit/relationships.test.ts` and the auth
tests — no mocks):
- Local scope: `.scope("active")` filters correctly; chaining two scopes
  combines their conditions (`AND`); calling an unregistered scope name
  throws with the expected message; scopes registered on one model class
  don't leak onto a sibling class (the `WeakMap` isolation).
- Global scope: applied automatically on `.all()`/`.find()`/`.where()`-based
  reads with no explicit opt-in; `withoutGlobalScope(name)` restores the
  excluded rows for that one query only (a fresh query without the opt-out
  is filtered again); `withoutGlobalScopes()` restores all of them at once;
  applying the same builder to two chained terminal calls (`paginate()`,
  which calls `count()` then `get()`) doesn't double-apply the scope's
  condition (assert the generated SQL or row count is correct, not just
  "no error").
- A model with both a registered local scope and a registered global scope,
  combined in one query, to prove they compose (`scope()` and the
  auto-applied global scope both contribute `WHERE` conditions, `AND`-ed
  together as `whereConditions` already combines everything).
