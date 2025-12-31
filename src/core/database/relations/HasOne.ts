import { Relation } from "./Relation";
import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";

/**
 * HasOne relationship
 * Example: User hasOne Profile
 */
export class HasOne<T extends Model = Model> extends Relation<T> {
  /**
   * Add constraints to the relationship query
   */
  protected addConstraints(query: QueryBuilder): QueryBuilder {
    const parentKey = this.getParentKey();
    return query.where(this.foreignKey, "=", parentKey);
  }

  /**
   * Get the relationship result
   */
  async get(): Promise<T | null> {
    let query = this.getRelatedQuery();
    query = this.addConstraints(query);
    
    const result = query.first();
    return this.hydrateOne(result);
  }

  /**
   * Create a related model
   */
  create(attributes: Record<string, any>): T {
    const parentKey = this.getParentKey();
    attributes[this.foreignKey] = parentKey;
    
    return this.related.create(attributes) as T;
  }

  /**
   * Save a related model
   */
  save(model: T): boolean {
    const parentKey = this.getParentKey();
    model.set(this.foreignKey, parentKey);
    return model.save();
  }
}
