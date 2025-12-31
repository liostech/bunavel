import { Relation } from "./Relation";
import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";
import { Collection } from "../../support/Collection";

/**
 * BelongsToMany relationship (many-to-many)
 * Example: User belongsToMany Roles (through user_roles pivot table)
 */
export class BelongsToMany<T extends Model = Model> extends Relation<T> {
  protected pivotTable: string;
  protected foreignPivotKey: string;
  protected relatedPivotKey: string;

  constructor(
    parent: Model,
    related: typeof Model,
    pivotTable?: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    parentKey?: string,
    relatedKey?: string
  ) {
    super(parent, related, foreignPivotKey, parentKey || "id");
    
    this.pivotTable = pivotTable || this.getDefaultPivotTable();
    this.foreignPivotKey = foreignPivotKey || this.getDefaultForeignPivotKey();
    this.relatedPivotKey = relatedPivotKey || this.getDefaultRelatedPivotKey();
  }

  /**
   * Get default pivot table name
   */
  protected getDefaultPivotTable(): string {
    const parentConstructor = this.parent.constructor as typeof Model;
    const parentTable = parentConstructor["getTable"]();
    const relatedTable = this.related["getTable"]();
    
    // Sort alphabetically: users + roles -> roles_users
    const tables = [parentTable, relatedTable].sort();
    return tables.join("_");
  }

  /**
   * Get default foreign pivot key
   */
  protected getDefaultForeignPivotKey(): string {
    const parentConstructor = this.parent.constructor as typeof Model;
    const parentTable = parentConstructor["getTable"]();
    return `${parentTable.slice(0, -1)}_id`;
  }

  /**
   * Get default related pivot key
   */
  protected getDefaultRelatedPivotKey(): string {
    const relatedTable = this.related["getTable"]();
    return `${relatedTable.slice(0, -1)}_id`;
  }

  /**
   * Add constraints to the relationship query
   */
  protected addConstraints(query: QueryBuilder): QueryBuilder {
    // This method is called for eager loading, we'll handle it differently
    return query;
  }

  /**
   * Get the relationship results
   */
  async get(): Promise<Collection<T>> {
    const parentKey = this.getParentKey();
    const relatedTable = this.related["getTable"]();
    
    // Build query with join on pivot table
    const results = this.getRelatedQuery()
      .join(
        this.pivotTable,
        `${relatedTable}.${this.localKey}`,
        "=",
        `${this.pivotTable}.${this.relatedPivotKey}`
      )
      .where(`${this.pivotTable}.${this.foreignPivotKey}`, "=", parentKey)
      .select(`${relatedTable}.*`)
      .get();
    
    return this.hydrate(results);
  }

  /**
   * Attach models to the relationship
   */
  attach(ids: number | number[], attributes: Record<string, any> = {}): void {
    const parentKey = this.getParentKey();
    const idsArray = Array.isArray(ids) ? ids : [ids];
    
    const parentConstructor = this.parent.constructor as typeof Model;
    const connection = parentConstructor["connection"];
    const query = new QueryBuilder(connection).table(this.pivotTable);
    
    idsArray.forEach(id => {
      query.insert({
        [this.foreignPivotKey]: parentKey,
        [this.relatedPivotKey]: id,
        ...attributes,
      });
    });
  }

  /**
   * Detach models from the relationship
   */
  detach(ids?: number | number[]): number {
    const parentKey = this.getParentKey();
    
    const parentConstructor = this.parent.constructor as typeof Model;
    const connection = parentConstructor["connection"];
    let query = new QueryBuilder(connection)
      .table(this.pivotTable)
      .where(this.foreignPivotKey, "=", parentKey);
    
    if (ids !== undefined) {
      const idsArray = Array.isArray(ids) ? ids : [ids];
      query = query.whereIn(this.relatedPivotKey, idsArray);
    }
    
    return query.delete();
  }

  /**
   * Sync the relationship (detach all, then attach provided)
   */
  sync(ids: number[], attributes: Record<string, any> = {}): void {
    this.detach();
    if (ids.length > 0) {
      this.attach(ids, attributes);
    }
  }

  /**
   * Toggle the attachment of models
   */
  toggle(ids: number | number[]): void {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    const parentKey = this.getParentKey();
    
    const parentConstructor = this.parent.constructor as typeof Model;
    const connection = parentConstructor["connection"];
    
    idsArray.forEach(id => {
      // Check if exists
      const exists = new QueryBuilder(connection)
        .table(this.pivotTable)
        .where(this.foreignPivotKey, "=", parentKey)
        .where(this.relatedPivotKey, "=", id)
        .first();
      
      if (exists) {
        this.detach(id);
      } else {
        this.attach(id);
      }
    });
  }
}
