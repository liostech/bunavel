import type { DatabaseConnection } from "./Connection";
import { QueryBuilder } from "./QueryBuilder";
import { Collection } from "../support/Collection";

export abstract class Model {
  protected static connection: DatabaseConnection;
  protected static tableName: string;
  protected primaryKey: string = "id";
  protected attributes: Record<string, any> = {};
  protected original: Record<string, any> = {};
  public exists: boolean = false;

  /**
   * Set the database connection
   */
  public static setConnection(connection: DatabaseConnection): void {
    this.connection = connection;
  }

  /**
   * Get the table name
   */
  protected static getTable(): string {
    if (this.tableName) {
      return this.tableName;
    }
    // Convert class name to snake_case plural (simple implementation)
    const className = this.name;
    return className.toLowerCase() + "s";
  }

  /**
   * Create a new query builder instance
   */
  public static query(): QueryBuilder {
    return new QueryBuilder(this.connection).table(this.getTable());
  }

  /**
   * Get all records
   */
  public static all<T extends Model>(): Collection<T> {
    const results = this.query().get();
    const models = results.map((row: any) => this.hydrate<T>(row));
    return new Collection(models);
  }

  /**
   * Find a record by ID
   */
  public static find<T extends Model>(id: number | string): T | null {
    const result = this.query().find(id);
    return result ? this.hydrate<T>(result) : null;
  }

  /**
   * Find a record by ID or throw error
   */
  public static findOrFail<T extends Model>(id: number | string): T {
    const model = this.find<T>(id);
    if (!model) {
      throw new Error(`Model not found with id: ${id}`);
    }
    return model;
  }

  /**
   * Get records matching conditions
   */
  public static where(column: string, operator: string, value?: any): QueryBuilder {
    return this.query().where(column, operator, value);
  }

  /**
   * Create a new record
   */
  public static create<T extends Model>(data: Record<string, any>): T {
    const id = this.query().insert(data);
    return this.find<T>(id)!;
  }

  /**
   * Update records matching conditions
   */
  public static updateWhere(conditions: Record<string, any>, data: Record<string, any>): number {
    let query = this.query();
    for (const [column, value] of Object.entries(conditions)) {
      query = query.where(column, "=", value);
    }
    return query.update(data);
  }

  /**
   * Delete records matching conditions
   */
  public static deleteWhere(conditions: Record<string, any>): number {
    let query = this.query();
    for (const [column, value] of Object.entries(conditions)) {
      query = query.where(column, "=", value);
    }
    return query.delete();
  }

  /**
   * Hydrate a model from database row
   */
  protected static hydrate<T extends Model>(data: Record<string, any>): T {
    const model = new (this as any)() as T;
    model.attributes = { ...data };
    model.original = { ...data };
    model.exists = true;
    return model;
  }

  /**
   * Constructor
   */
  constructor(attributes: Record<string, any> = {}) {
    this.attributes = attributes;
  }

  /**
   * Get an attribute
   */
  public get(key: string): any {
    return this.attributes[key];
  }

  /**
   * Set an attribute
   */
  public set(key: string, value: any): this {
    this.attributes[key] = value;
    return this;
  }

  /**
   * Fill the model with attributes
   */
  public fill(attributes: Record<string, any>): this {
    this.attributes = { ...this.attributes, ...attributes };
    return this;
  }

  /**
   * Save the model
   */
  public save(): boolean {
    const constructor = this.constructor as typeof Model;
    
    if (this.exists) {
      // Update existing record
      const id = this.attributes[this.primaryKey];
      const changes = this.getDirty();
      if (Object.keys(changes).length > 0) {
        constructor.query().where(this.primaryKey, "=", id).update(changes);
        this.original = { ...this.attributes };
      }
    } else {
      // Insert new record
      const id = constructor.query().insert(this.attributes);
      this.attributes[this.primaryKey] = id;
      this.original = { ...this.attributes };
      this.exists = true;
    }
    
    return true;
  }

  /**
   * Delete the model
   */
  public delete(): boolean {
    if (!this.exists) {
      return false;
    }

    const constructor = this.constructor as typeof Model;
    const id = this.attributes[this.primaryKey];
    constructor.query().where(this.primaryKey, "=", id).delete();
    this.exists = false;
    
    return true;
  }

  /**
   * Get changed attributes
   */
  protected getDirty(): Record<string, any> {
    const dirty: Record<string, any> = {};
    for (const [key, value] of Object.entries(this.attributes)) {
      if (value !== this.original[key]) {
        dirty[key] = value;
      }
    }
    return dirty;
  }

  /**
   * Check if model has been modified
   */
  public isDirty(): boolean {
    return Object.keys(this.getDirty()).length > 0;
  }

  /**
   * Get all attributes as plain object
   */
  public toJson(): Record<string, any> {
    return { ...this.attributes };
  }

  /**
   * Convert model to JSON string
   */
  public toString(): string {
    return JSON.stringify(this.toJson());
  }
}
