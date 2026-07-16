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
