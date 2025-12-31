import { QueryBuilder } from "../QueryBuilder";
import { Model } from "../Model";
import { Collection } from "../../support/Collection";

/**
 * Base Relation class for Eloquent relationships
 */
export abstract class Relation<T extends Model = Model> {
  public parent: Model;
  public related: typeof Model;
  public foreignKey: string;
  public localKey: string;

  constructor(
    parent: Model,
    related: typeof Model,
    foreignKey?: string,
    localKey?: string
  ) {
    this.parent = parent;
    this.related = related;
    
    // Set keys with defaults
    this.foreignKey = foreignKey || this.getDefaultForeignKey();
    this.localKey = localKey || "id";
  }

  /**
   * Get default foreign key name
   */
  protected getDefaultForeignKey(): string {
    // Get parent table name from constructor
    const parentConstructor = this.parent.constructor as typeof Model;
    const parentTable = parentConstructor["getTable"]();
    // users -> user_id
    return `${parentTable.slice(0, -1)}_id`;
  }

  /**
   * Get the query builder for the related model
   */
  public getRelatedQuery(): QueryBuilder {
    return this.related.query();
  }

  /**
   * Add constraints to the relationship query
   */
  protected abstract addConstraints(query: QueryBuilder): QueryBuilder;

  /**
   * Get the results of the relationship
   */
  abstract get(): Promise<T | T[] | Collection<T> | null>;

  /**
   * Convert raw results to model instances
   */
  public hydrate(results: any[]): Collection<T> {
    const models = results.map(result => {
      return this.related["hydrate"](result) as T;
    });
    
    return new Collection(models);
  }

  /**
   * Convert single result to model instance
   */
  public hydrateOne(result: any): T | null {
    if (!result) return null;
    return this.related["hydrate"](result) as T;
  }

  /**
   * Get foreign key value from parent
   */
  protected getParentKey(): any {
    return this.parent.get(this.localKey);
  }
}
