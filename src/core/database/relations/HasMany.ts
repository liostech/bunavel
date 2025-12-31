import { Relation } from "./Relation";
import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";
import { Collection } from "../../support/Collection";

/**
 * HasMany relationship
 * Example: User hasMany Posts
 */
export class HasMany<T extends Model = Model> extends Relation<T> {
  /**
   * Add constraints to the relationship query
   */
  protected addConstraints(query: QueryBuilder): QueryBuilder {
    const parentKey = this.getParentKey();
    return query.where(this.foreignKey, "=", parentKey);
  }

  /**
   * Get the relationship results
   */
  async get(): Promise<Collection<T>> {
    let query = this.getRelatedQuery();
    query = this.addConstraints(query);
    
    const results = query.get();
    return this.hydrate(results);
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

  /**
   * Save multiple related models
   */
  saveMany(models: T[]): boolean {
    models.forEach(model => this.save(model));
    return true;
  }

  /**
   * Create multiple related models
   */
  createMany(records: Record<string, any>[]): Collection<T> {
    const models = records.map(record => this.create(record));
    return new Collection(models);
  }
}
