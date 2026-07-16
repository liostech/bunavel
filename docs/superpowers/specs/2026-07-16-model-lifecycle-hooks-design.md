# Model Lifecycle Hooks — Design

## Summary

Add Laravel-style model lifecycle hooks: per-model-class callbacks that fire
around `save()`/`delete()` — `creating`/`created`, `updating`/`updated`,
`saving`/`saved`, `deleting`/`deleted` — with the "ing" hooks able to cancel
the operation by returning `false`, exactly matching Laravel's own
cancellation semantics. The `SoftDeletes` mixin (shipped) gets
`restoring`/`restored` and is updated to explicitly re-dispatch
`deleting`/`deleted` around its soft `delete()` override, closing the seam
flagged when soft deletes shipped. Sixth of the remaining Laravel-parity
features (route groups → query scopes → soft deletes → **model lifecycle
hooks** → sessions → API resources).

## Non-goals

- **Routing through the existing general-purpose `EventDispatcher`.**
  Checked it first: `EventDispatcher` is instance-based
  (`new EventDispatcher()`, `.listen(EventClass, ...)`, typed `Event`
  classes, async-capable listeners) — designed for decoupled app-level
  pub/sub, not per-model-class lifecycle callbacks. There's no natural
  single shared dispatcher instance for `Model` to hold, and forcing one
  would create an implicit dependency `Model` doesn't otherwise have. This
  feature ships its own lightweight registry instead, following the same
  per-class `WeakMap<typeof Model, ...>` pattern query-scopes already
  established and proved.
- **Async hook callbacks.** `save()`/`delete()` are synchronous today
  (`bun:sqlite` is sync). Making hooks `async`-capable would require making
  `save()`/`delete()` async — a breaking signature change rippling through
  every existing caller in the codebase (`AuthController`, every model, every
  test). Hooks stay synchronous (`(model: Model) => boolean | void`); for
  async side effects (send an email, sync a search index), dispatch through
  the already-built Queue or Event systems from inside a hook instead of
  blocking the save.
- **Hooks firing for `Model.create()`, `Model.updateWhere()`,
  `Model.deleteWhere()`.** These static bulk/convenience helpers bypass
  instance-level behavior already — `deleteWhere()` doesn't respect soft
  deletes either (documented limitation from the soft-deletes feature).
  Extending this scoping consistently: only the *instance* methods
  `save()`/`delete()` (and `SoftDeletes`'s `restore()`) fire hooks.
  `Model.create()` specifically also has a behavioral reason to stay
  untouched: it currently does a raw `insert()` followed by a `find()`
  re-fetch, which is how columns with SQL `DEFAULT CURRENT_TIMESTAMP` (e.g.
  `created_at`/`updated_at` via `table.timestamps()`) end up populated on
  the returned instance. Routing `create()` through `save()` instead would
  skip that re-fetch (since `save()` on a new instance just sets the
  primary key locally, no re-fetch), silently dropping DB-computed defaults
  from the returned object — not worth the regression risk for hook
  coverage on a helper method.
- **Laravel's `forceDeleting`/`forceDeleted` distinct event names.**
  `SoftDeletes.forceDelete()` calls `super.delete()` (the original
  `Model.prototype.delete()`), which — once this feature ships — already
  fires `deleting`/`deleted` itself. Reusing those same names for a forced
  delete (rather than adding a separate `forceDeleting`/`forceDeleted` pair,
  which is a Laravel 9+ refinement) is simpler and "free" via the existing
  call chain.
- **`retrieved` hook** (fires when a model is hydrated from a query) — not
  requested, and every `hydrate()` call site would need touching; add later
  if needed.

## API

```ts
class User extends Model {
  static override tableName = "users";

  static {
    this.creating((user) => {
      user.set("uuid", crypto.randomUUID());
    });

    this.created((user) => {
      console.log("created user", user.get("id"));
    });

    this.deleting((user) => {
      if (user.get("isProtected")) {
        return false; // cancels the delete
      }
    });
  }
}
```

- `Model.creating/created/updating/updated/saving/saved/deleting/deleted(callback: HookCallback): void` —
  static registration methods, one per hook name, following the exact
  `static { this.addScope(...) }` registration convention query-scopes
  established. Multiple callbacks can be registered for the same hook name
  (unlike scopes, which are unique by name) — all run, in registration
  order.
- `HookCallback = (model: Model) => boolean | void` — receives the model
  instance being saved/deleted (already `.fill()`-able/mutable — a
  `creating` callback setting an attribute via `user.set(...)` is reflected
  in the subsequent INSERT, matching Laravel exactly).
- **Cancellation, exactly like Laravel:** if a `creating`, `updating`,
  `saving`, or `deleting` callback returns `false` (checked via strict
  `=== false`, so returning `undefined`/nothing/any truthy value does not
  cancel), the operation aborts immediately — no further callbacks for that
  hook run, the DB is not touched, and `save()`/`delete()` returns `false`.
  The "after" hooks (`created`, `updated`, `saved`, `deleted`) never cancel
  anything, since by the time they run the operation already happened —
  matches Laravel's own semantics precisely.
- A model with a soft-delete mixin gets two more registration methods,
  added by the mixin itself (not on base `Model`, matching how
  `restore()`/`trashed()` etc. are already opt-in-only): `restoring`/
  `restored(callback: HookCallback): void`.

## Execution model

`Model.save()` changes to fire hooks around both its insert and update
branches:

```
save():
  if fireHook("saving") === false → return false
  if updating (this.exists):
    if fireHook("updating") === false → return false
    ...existing update logic...
    fireHook("updated")
  else (inserting):
    if fireHook("creating") === false → return false
    ...existing insert logic...
    fireHook("created")
  fireHook("saved")
  return true
```

`Model.prototype.delete()` (the physical delete) changes to:

```
delete():
  if !this.exists → return false
  if fireHook("deleting") === false → return false
  ...existing delete logic...
  fireHook("deleted")
  return true
```

`fireHook(name, model)` is a `protected static` method on `Model` (not
`private` — `SoftDeletes`'s mixin class needs to call it too, and since the
mixin's returned class `extends Base` where `Base` resolves to `Model` in
the chain, `protected static` members are reachable via normal
inheritance). It looks up `Model.hooksRegistry.get(this)?.get(name)` (the
same `this`-is-the-actual-leaf-class late-static-binding pattern
`addGlobalScope`/`getScope` and `SoftDeletes`'s lazy `query()` registration
already rely on), runs each registered callback against `model`, and
returns `false` the instant one callback returns `false` — short-circuiting
the rest (matching Laravel: the first `false` wins, remaining listeners for
that hook don't run).

`SoftDeletes.ts` changes:

- `delete()` (soft) now explicitly wraps its body with
  `fireHook("deleting", this)` / `fireHook("deleted", this)`, since it
  calls `this.save()` rather than `super.delete()` and would otherwise
  never fire the base delete hooks at all (the exact seam flagged when
  soft deletes shipped — see the `[[project-lifecycle-hooks-softdeletes-seam]]`
  memory). Note this means a soft `delete()` call fires `deleting` +
  (`saving`, `updating`, `updated`, `saved` — since the underlying
  mechanism genuinely is a `save()` call setting `deleted_at`) + `deleted`.
  This is a known, documented simplification versus Laravel's more
  surgical internal event sequencing (which avoids firing `updating` during
  a soft delete) — reproducing that exactly would require bypassing the
  shared `save()` path for soft deletes, adding real complexity for a
  cosmetic difference in which hooks additionally fire. Not attempting that
  here.
- `forceDelete()` is unchanged (`return super.delete();`) — it already
  fires `deleting`/`deleted` for free once `Model.prototype.delete()` fires
  them, with no extra code needed.
- `restore()` gains `fireHook("restoring", this)` / `fireHook("restored", this)`
  around its body, with the same cancellation semantics (`restoring`
  returning `false` aborts the restore).
- Two new static registration methods, `restoring`/`restored`, added to
  the mixin's returned class (calling the same inherited `protected static
  registerHook`/equivalent registration primitive `Model` exposes) — only
  present on the type of models that use `SoftDeletes(Model)`, matching the
  existing opt-in-only pattern for `trashed()`/`withTrashed()`/etc.

## Per-class isolation

Same `WeakMap<typeof Model, Map<string, HookCallback[]>>` pattern as
query-scopes' registries — keyed by the actual registering class, so hooks
registered on `User` never fire for `Post`. (Difference from scopes: the
inner `Map`'s values are arrays, since multiple callbacks can share one
hook name, where scopes are unique-by-name.)

## Error handling

- No new runtime error paths. A callback that throws propagates normally
  (uncaught by the hook-firing loop) — matches how any other synchronous
  callback in this codebase behaves (e.g. `QueryBuilder.scope()`'s
  callback), no special try/catch wrapping.
- Cancellation is signaled by return value (`=== false`), not by throwing —
  matches Laravel's own convention and keeps `save()`/`delete()`'s
  `boolean` return type meaningful (`false` now has a real, reachable
  meaning: "cancelled by a hook," alongside the pre-existing `false` case
  of `delete()` on a non-existent record).

## Touches to existing code

- `src/core/database/Model.ts` — add `HookCallback` type, the
  `hooksRegistry` `WeakMap`, `protected static registerHook`/`fireHook`,
  the 8 public static registration methods, and hook-firing calls inserted
  into `save()` and `delete()`. This is the one feature in the
  fundamental-first sequence so far that genuinely modifies existing
  `Model.ts` control flow (query-scopes and soft-deletes were purely
  additive) — expected, since the whole point is instrumenting `save()`/
  `delete()` themselves.
- `src/core/database/SoftDeletes.ts` — `delete()`'s body wraps
  `fireHook("deleting"/"deleted")`; new `restore()` wraps
  `fireHook("restoring"/"restored")`; two new static registration methods
  (`restoring`, `restored`).
- `src/index.ts` — export `HookCallback` (type-only).

## Testing

New `tests/unit/lifecycle-hooks.test.ts` (real in-memory SQLite, no mocks):
- `creating`/`created` fire on insert, in the right order, with the model
  instance already carrying whatever a `creating` callback set via `.set()`
  reflected in the inserted row.
- `updating`/`updated` fire on update (not on insert); `saving`/`saved`
  fire on both.
- Returning `false` from `creating` aborts the insert (`save()` returns
  `false`, no row is written, `this.exists` stays `false`).
- Returning `false` from `updating` aborts the update (row unchanged).
- Returning `false` from `deleting` aborts the delete (row still present,
  `this.exists` stays `true`).
- Multiple callbacks registered for the same hook name all run, in
  registration order, until one returns `false`.
- Hooks registered on one model class don't fire for a sibling class (same
  isolation guarantee query-scopes already tests, reapplied here).
- `SoftDeletes`-specific: soft `delete()` fires `deleting`/`deleted`;
  `restore()` fires `restoring`/`restored`; returning `false` from
  `restoring` aborts the restore; `forceDelete()` fires `deleting`/`deleted`
  via the `super.delete()` passthrough with no extra wiring needed.
