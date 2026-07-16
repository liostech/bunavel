# Soft Deletes — Design

## Summary

Add Laravel-style soft deletes to Bunavel via a `SoftDeletes` mixin function:
`class Post extends SoftDeletes(Model) {}` opts a model into "deleting" a row
by setting `deleted_at` instead of removing it, with a global scope
automatically hiding soft-deleted rows from normal queries. Fourth of the
remaining Laravel-parity features (route groups → query scopes → **soft
deletes** → model lifecycle hooks → sessions → API resources), built
directly on the global-scope mechanism just shipped.

## Non-goals

- **Configurable column name.** The soft-delete column is fixed as
  `deleted_at`, matching near-universal Laravel convention. No
  `getDeletedAtColumn()`-style override hook — add one later if a real need
  shows up (unlike `EloquentUserProvider`'s `usernameField`/`passwordField`,
  which needed configurability because email/username conventions genuinely
  vary across apps; `deleted_at` doesn't).
- **Cascading soft deletes** (soft-deleting a parent automatically
  soft-deleting its children) — not requested.
- **`static {}`-block scope registration inside the mixin.** A `static {}`
  block's `this` is bound to the class it's lexically written in — inside
  the mixin function's returned class expression, that's an intermediate
  anonymous class, not the actual leaf model (e.g. `Post`). Registering the
  global scope there would key it to the wrong class in the
  `WeakMap<typeof Model, ...>` registry query-scopes already ships, and the
  scope would silently never apply. See Execution model below for the fix
  (lazy registration on first `query()` call, which correctly resolves
  `this` to the leaf class via normal method dispatch).
- **Changes to `Model.ts`'s or `QueryBuilder.ts`'s already-shipped
  scope-registry code.** The lazy-registration fix lives entirely in the new
  `SoftDeletes` mixin file — no prototype-chain walking or other changes to
  the exact-key `WeakMap` lookup that query scopes already ships and tests.

## API

```ts
import { Model } from "../../src/core/database/Model";
import { SoftDeletes } from "../../src/core/database/SoftDeletes";

class Post extends SoftDeletes(Model) {
  static override tableName = "posts";
}

Post.all();                 // excludes soft-deleted rows
Post.find(1);                // null if row 1 is soft-deleted
Post.withTrashed().get();    // includes soft-deleted rows
Post.onlyTrashed().get();    // only soft-deleted rows

const post = Post.find(1)!;
post.delete();                // sets deleted_at, row stays in the table
post.trashed();               // true
post.restore();                // deleted_at = null
post.forceDelete();            // actually removes the row
```

A plain `class Post extends Model {}` (no mixin) has none of
`restore`/`trashed`/`forceDelete`/`withTrashed`/`onlyTrashed` in its type —
calling one is a compile error, not a runtime surprise. `Post.delete()`
without the mixin is unchanged (Model's existing physical delete).

## Execution model

`SoftDeletes<TBase extends typeof Model>(Base: TBase)` returns a class
extending `Base` that:

- Overrides `static query(): QueryBuilder` to lazily register the
  `"softDelete"` global scope (`query => query.whereNull("deleted_at")`) the
  first time `query()` is called on the actual leaf class, guarded by a
  private static boolean flag, then delegates to `super.query()`. Because
  this is a normal method call (not a `static {}` block), `this` correctly
  resolves to whichever concrete class the call originated from (`Post`,
  not the mixin's intermediate class) — `Post.find(1)` → `Post.query()`
  (inherited call, `this === Post`) → registers on first call, keyed
  correctly in the already-shipped `WeakMap` by `Post` itself. Every
  existing static query entry point (`all`, `find`, `where`, `paginate`,
  `with`, `create`, `updateWhere`, `deleteWhere`) already funnels through
  `.query()`, so all of them pick up the scope with zero further changes.
- Overrides `delete(): boolean` (instance method) to set `deleted_at` to the
  current timestamp and call `save()`, instead of physically removing the
  row — mirrors the shape of the existing `Model.prototype.delete()` (the
  `!this.exists` guard, returning `boolean`) but never issues a `DELETE`.
- Adds `forceDelete(): boolean`, which calls `super.delete()` — the
  *original*, physical `Model.prototype.delete()` — for genuinely removing a
  row.
- Adds `restore(): boolean`, which sets `deleted_at` to `null` and saves.
- Adds `trashed(): boolean`, checking whether `deleted_at` is set.
- Adds `static withTrashed(): QueryBuilder` /
  `static onlyTrashed(): QueryBuilder`, thin wrappers over
  `this.query().withoutGlobalScope("softDelete")` (and, for `onlyTrashed`,
  an additional `.whereNotNull("deleted_at")`) — both already-shipped
  `QueryBuilder` capabilities from the query-scopes feature, used exactly as
  designed.

Global scopes only affect `buildSelectQuery()`-based reads (established by
query-scopes) — `forceDelete()`'s physical `DELETE` and `restore()`/soft
`delete()`'s `UPDATE` (via `save()`) never route through scope filtering, so
they work correctly regardless of the row's current `deleted_at` state.

## Migration / schema note

Any model using `SoftDeletes` needs a nullable `deleted_at` column on its
table. This spec doesn't add a schema-builder helper for it (Laravel has
`$table->softDeletes()`) — out of scope; a model's own migration just adds
`table.string("deleted_at").nullable()` (or a `datetime`/`timestamp` column)
like any other column. Add a `Blueprint.softDeletes()` convenience later if
repeating this by hand across migrations becomes real friction.

## Error handling

- Calling `restore()`/`trashed()`/`forceDelete()`/`withTrashed()`/
  `onlyTrashed()` on a model that doesn't extend `SoftDeletes(Model)` is a
  compile-time type error (the methods don't exist on the type) — no
  runtime error handling needed for this case, it can't happen in code that
  passes `tsc`.
- No new runtime error paths — `delete()`/`restore()` reuse the existing
  `save()`/`Model` machinery unchanged.

## Touches to existing code

None. This is a pure addition: one new file
(`src/core/database/SoftDeletes.ts`) and a barrel export. No changes to
`Model.ts` or `QueryBuilder.ts` — the whole point of the lazy-registration
design is to need zero changes to the already-shipped, already-reviewed
scope infrastructure.

## Implementation-time verification note

`Model` is declared `export abstract class Model`. Generic mixin functions
over abstract base classes occasionally need the type constraint written as
`TBase extends abstract new (...args: any[]) => Model` rather than
`TBase extends typeof Model`, depending on how TypeScript resolves
`class extends Base {}` inside the function body for an abstract `Base`.
The plan should have the implementer try `TBase extends typeof Model` first
(simpler, matches this codebase's existing style of typing model-class
parameters, e.g. `EloquentUserProvider`'s `modelClass: typeof Model`) and
fall back to the `abstract new (...)` form only if `bun test` reveals an
actual runtime/transpilation failure — this project has no `tsc`-based CI
gate, so a purely cosmetic type-checker complaint here (if any) is not
blocking, consistent with how the `QueryBuilder.where()` 2-arg-form gap was
triaged in the query-scopes review.

## Testing

New `tests/unit/soft-deletes.test.ts` (real in-memory SQLite, no mocks):
- `delete()` sets `deleted_at` instead of removing the row (row still exists
  when queried via `withTrashed()`, but `find()`/`all()` no longer see it).
- `trashed()` reflects the current `deleted_at` state.
- `withTrashed()` includes soft-deleted rows; `onlyTrashed()` returns only
  them.
- `restore()` clears `deleted_at` and un-hides the row from normal queries.
- `forceDelete()` physically removes the row (gone even from
  `withTrashed()`).
- A plain `Model` subclass (no mixin) pointed at the same table is
  unaffected by the scope registered on a `SoftDeletes`-using sibling class
  — proves the lazy-registration fix correctly keys to the leaf class and
  doesn't leak, matching the isolation guarantee query-scopes already
  established.
