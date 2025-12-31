import type { DatabaseConnection } from "./Connection";
import { QueryBuilder } from "./QueryBuilder";
import { Collection } from "../support/Collection";
import { Paginator } from "./Paginator";
import { HasOne } from "./relations/HasOne";
import { HasMany } from "./relations/HasMany";
import { BelongsTo } from "./relations/BelongsTo";
import { BelongsToMany } from "./relations/BelongsToMany";

export abstract class Model {
  protected static connection: DatabaseConnection;
  protected static tableName: string;
  protected primaryKey: string = "id";
  protected attributes: Record<string, any> = {};
  protected original: Record<string, any> = {};
  public exists: boolean = false;
  protected relations: Record<string, any> = {};

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
    return new QueryBuilder(this.connection).table(this.getTable()).setModel(this);
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
   * Get all records with eager loaded relationships
   */
  public static with<T extends Model>(...relations: string[]): QueryBuilder {
    return this.query().with(...relations);
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
   * Paginate records
   */
  public static paginate<T extends Model>(perPage: number = 15, page: number = 1): Paginator<T> {
    const paginator = this.query().paginate(perPage, page);
    
    // Hydrate the items
    const items = paginator.data().map((row: any) => this.hydrate<T>(row)).toArray();
    
    return new Paginator(
      items,
      paginator.getTotal(),
      paginator.getPerPage(),
      paginator.getCurrentPage()
    );
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

  /**
   * Load relationships into the model
   */
  public setRelation(name: string, value: any): this {
    this.relations[name] = value;
    return this;
  }

  /**
   * Get a loaded relationship
   */
  public getRelation(name: string): any {
    return this.relations[name];
  }

  /**
   * Check if a relationship is loaded
   */
  public relationLoaded(name: string): boolean {
    return name in this.relations;
  }

  /**
   * Load relationships onto the model
   */
  public async load(...relations: string[]): Promise<this> {
    const constructor = this.constructor as typeof Model;
    
    for (const relationName of relations) {
      // Get the relationship method
      const relationMethod = (this as any)[relationName];
      if (typeof relationMethod === 'function') {
        const relation = relationMethod.call(this);
        const result = await relation.get();
        this.setRelation(relationName, result);
      }
    }
    
    return this;
  }

  /**
   * Define a one-to-one relationship
   */
  protected hasOne<T extends Model>(
    related: typeof Model,
    foreignKey?: string,
    localKey?: string
  ): HasOne<T> {
    return new HasOne<T>(this, related, foreignKey, localKey);
  }

  /**
   * Define a one-to-many relationship
   */
  protected hasMany<T extends Model>(
    related: typeof Model,
    foreignKey?: string,
    localKey?: string
  ): HasMany<T> {
    return new HasMany<T>(this, related, foreignKey, localKey);
  }

  /**
   * Define an inverse one-to-one or one-to-many relationship
   */
  protected belongsTo<T extends Model>(
    related: typeof Model,
    foreignKey?: string,
    ownerKey?: string
  ): BelongsTo<T> {
    return new BelongsTo<T>(this, related, foreignKey, ownerKey);
  }

  /**
   * Define a many-to-many relationship
   */
  protected belongsToMany<T extends Model>(
    related: typeof Model,
    pivotTable?: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    parentKey?: string,
    relatedKey?: string
  ): BelongsToMany<T> {
    return new BelongsToMany<T>(
      this,
      related,
      pivotTable,
      foreignPivotKey,
      relatedPivotKey,
      parentKey,
      relatedKey
    );
  }
}
