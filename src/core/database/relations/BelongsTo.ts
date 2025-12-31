import { Relation } from "./Relation";
import { Model } from "../Model";
import { QueryBuilder } from "../QueryBuilder";

/**
 * BelongsTo relationship
 * Example: Post belongsTo User
 */
export class BelongsTo<T extends Model = Model> extends Relation<T> {
  public ownerKey: string;

  constructor(
    parent: Model,
    related: typeof Model,
    foreignKey?: string,
    ownerKey?: string
  ) {
    super(parent, related, foreignKey, ownerKey || "id");
    this.ownerKey = ownerKey || "id";
  }

  /**
   * Get default foreign key name for BelongsTo
   */
  protected override getDefaultForeignKey(): string {
    // Get related model table name
    const relatedTable = this.related["getTable"]();
    // users -> user_id
    return `${relatedTable.slice(0, -1)}_id`;
  }

  /**
   * Add constraints to the relationship query
   */
  protected addConstraints(query: QueryBuilder): QueryBuilder {
    const foreignKeyValue = this.parent.get(this.foreignKey);
    return query.where(this.localKey, "=", foreignKeyValue);
  }

  /**
   * Get the relationship result
   */
  async get(): Promise<T | null> {
    const foreignKeyValue = this.parent.get(this.foreignKey);
    
    if (!foreignKeyValue) {
      return null;
    }

    let query = this.getRelatedQuery();
    query = this.addConstraints(query);
    
    const result = query.first();
    return this.hydrateOne(result);
  }

  /**
   * Associate a model with the parent
   */
  async associate(model: T): Promise<boolean> {
    const ownerKey = model.get(this.localKey);
    this.parent.set(this.foreignKey, ownerKey);
    await this.parent.save();
    return true;
  }

  /**
   * Dissociate the model from the parent
   */
  async dissociate(): Promise<boolean> {
    this.parent.set(this.foreignKey, null);
    await this.parent.save();
    return true;
  }
}
