import type { DatabaseConnection } from "./Connection";
import { Paginator } from "./Paginator";
import type { Model } from "./Model";

export class QueryBuilder {
  private connection: DatabaseConnection;
  private tableName: string = "";
  private selectColumns: string[] = ["*"];
  private whereConditions: { column: string; operator: string; value: any }[] = [];
  private orderByColumns: { column: string; direction: "ASC" | "DESC" }[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private joinClauses: string[] = [];
  private eagerLoadRelations: string[] = [];
  private modelClass?: typeof Model;
  private globalScopesApplied: boolean = false;
  private removedGlobalScopeNames: Set<string> = new Set();
  private allGlobalScopesRemoved: boolean = false;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
  }

  /**
   * Set the table to query
   */
  public table(table: string): this {
    this.tableName = table;
    return this;
  }

  /**
   * Set the model class for eager loading
   */
  public setModel(modelClass: typeof Model): this {
    this.modelClass = modelClass;
    return this;
  }

  /**
   * Set columns to select
   */
  public select(...columns: string[]): this {
    this.selectColumns = columns;
    return this;
  }

  /**
   * Add a WHERE clause
   */
  public where(column: string, operator: string, value?: any): this {
    // If only 2 arguments, assume operator is '='
    if (value === undefined) {
      value = operator;
      operator = "=";
    }
    this.whereConditions.push({ column, operator, value });
    return this;
  }

  /**
   * Add a WHERE IN clause
   */
  public whereIn(column: string, values: any[]): this {
    this.whereConditions.push({ column, operator: "IN", value: values });
    return this;
  }

  /**
   * Add a WHERE NULL clause
   */
  public whereNull(column: string): this {
    this.whereConditions.push({ column, operator: "IS NULL", value: null });
    return this;
  }

  /**
   * Add a WHERE NOT NULL clause
   */
  public whereNotNull(column: string): this {
    this.whereConditions.push({ column, operator: "IS NOT NULL", value: null });
    return this;
  }

  /**
   * Add an ORDER BY clause
   */
  public orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    this.orderByColumns.push({ column, direction });
    return this;
  }

  /**
   * Set LIMIT
   */
  public limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  /**
   * Set OFFSET
   */
  public offset(value: number): this {
    this.offsetValue = value;
    return this;
  }

  /**
   * Add a JOIN clause
   */
  public join(table: string, firstColumn: string, operator: string, secondColumn: string): this {
    this.joinClauses.push(`INNER JOIN ${table} ON ${firstColumn} ${operator} ${secondColumn}`);
    return this;
  }

  /**
   * Add a LEFT JOIN clause
   */
  public leftJoin(table: string, firstColumn: string, operator: string, secondColumn: string): this {
    this.joinClauses.push(`LEFT JOIN ${table} ON ${firstColumn} ${operator} ${secondColumn}`);
    return this;
  }

  /**
   * Eager load relationships
   */
  public with(...relations: string[]): this {
    this.eagerLoadRelations.push(...relations);
    return this;
  }

  /**
   * Get eager load relations
   */
  public getEagerLoadRelations(): string[] {
    return this.eagerLoadRelations;
  }

  /**
   * Apply a named local scope registered on the query's model
   */
  public scope(name: string, ...args: any[]): this {
    if (!this.modelClass) {
      throw new Error(`Cannot apply scope "${name}": no model is associated with this query.`);
    }
    const callback = this.modelClass.getScope(name);
    if (!callback) {
      throw new Error(`Scope "${name}" is not defined on ${this.modelClass.name}.`);
    }
    callback(this, ...args);
    return this;
  }

  /**
   * Exclude a specific global scope from this query
   */
  public withoutGlobalScope(name: string): this {
    this.removedGlobalScopeNames.add(name);
    return this;
  }

  /**
   * Exclude all global scopes from this query
   */
  public withoutGlobalScopes(): this {
    this.allGlobalScopesRemoved = true;
    return this;
  }

  /**
   * Apply the model's registered global scopes to this query, once
   */
  private applyGlobalScopes(): void {
    if (this.globalScopesApplied || !this.modelClass || this.allGlobalScopesRemoved) {
      this.globalScopesApplied = true;
      return;
    }
    this.globalScopesApplied = true;

    const scopes = this.modelClass.getGlobalScopes();
    for (const [name, callback] of scopes) {
      if (!this.removedGlobalScopeNames.has(name)) {
        callback(this);
      }
    }
  }

  /**
   * Build the SQL query
   */
  private buildSelectQuery(): { sql: string; params: any[] } {
    this.applyGlobalScopes();
    let sql = `SELECT ${this.selectColumns.join(", ")} FROM ${this.tableName}`;
    const params: any[] = [];

    // Add JOINs
    if (this.joinClauses.length > 0) {
      sql += ` ${this.joinClauses.join(" ")}`;
    }

    // Add WHERE clauses
    if (this.whereConditions.length > 0) {
      const whereParts: string[] = [];
      for (const condition of this.whereConditions) {
        if (condition.operator === "IN") {
          const placeholders = condition.value.map(() => "?").join(", ");
          whereParts.push(`${condition.column} IN (${placeholders})`);
          params.push(...condition.value);
        } else if (condition.operator === "IS NULL" || condition.operator === "IS NOT NULL") {
          whereParts.push(`${condition.column} ${condition.operator}`);
        } else {
          whereParts.push(`${condition.column} ${condition.operator} ?`);
          params.push(condition.value);
        }
      }
      sql += ` WHERE ${whereParts.join(" AND ")}`;
    }

    // Add ORDER BY
    if (this.orderByColumns.length > 0) {
      const orderParts = this.orderByColumns.map(o => `${o.column} ${o.direction}`);
      sql += ` ORDER BY ${orderParts.join(", ")}`;
    }

    // Add LIMIT and OFFSET (LIMIT must come before OFFSET in SQLite)
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
      if (this.offsetValue !== undefined) {
        sql += ` OFFSET ${this.offsetValue}`;
      }
    } else if (this.offsetValue !== undefined) {
      // If OFFSET without LIMIT, use a very large LIMIT
      sql += ` LIMIT -1 OFFSET ${this.offsetValue}`;
    }

    return { sql, params };
  }

  /**
   * Execute the query and get all results
   */
  public get(): any[] {
    const { sql, params } = this.buildSelectQuery();
    const results = this.connection.query(sql, params);
    
    // If eager loading relationships and we have a model class
    if (this.eagerLoadRelations.length > 0 && this.modelClass) {
      return this.eagerLoadRelationships(results);
    }
    
    return results;
  }

  /**
   * Eager load relationships for the given models
   */
  private eagerLoadRelationships(results: any[]): any[] {
    if (!this.modelClass || results.length === 0) {
      return results;
    }

    // Hydrate models
    const models = results.map((row: any) => this.modelClass!["hydrate"](row));

    // Load each relationship
    for (const relationName of this.eagerLoadRelations) {
      this.eagerLoadRelation(models, relationName);
    }

    // Convert back to plain objects to maintain compatibility
    return models.map((model: any) => {
      const data = model.toJson();
      // Add loaded relations to the output
      for (const relationName of this.eagerLoadRelations) {
        if (model.relationLoaded(relationName)) {
          const relation = model.getRelation(relationName);
          // Convert Collection or Model to JSON
          if (relation === null || relation === undefined) {
            data[relationName] = relation;
          } else if (Array.isArray(relation)) {
            // Already an array
            data[relationName] = relation.map((m: any) => 
              typeof m.toJson === 'function' ? m.toJson() : m
            );
          } else if (typeof relation.toArray === 'function') {
            // Collection - convert to array
            data[relationName] = relation.toArray().map((m: any) => 
              typeof m.toJson === 'function' ? m.toJson() : m
            );
          } else if (typeof relation.toJson === 'function') {
            // Single model
            data[relationName] = relation.toJson();
          } else {
            data[relationName] = relation;
          }
        }
      }
      return data;
    });
  }

  /**
   * Eager load a single relationship onto the models
   */
  private eagerLoadRelation(models: any[], relationName: string): void {
    if (models.length === 0) return;

    // Get the first model to determine the relationship type
    const firstModel = models[0];
    const relationMethod = firstModel[relationName];
    
    if (typeof relationMethod !== 'function') {
      console.warn(`Relationship ${relationName} not found on model`);
      return;
    }

    // Get the relation instance
    const relation = relationMethod.call(firstModel);
    
    // Get all parent keys
    const parentKeys = models.map((model: any) => model.get('id')).filter((id: any) => id != null);
    
    if (parentKeys.length === 0) return;

    // Determine the foreign key from the relation
    const foreignKey = relation.foreignKey || 'id';
    
    // Load all related models in one query
    const relatedQuery = relation.getRelatedQuery();
    
    // For HasMany and HasOne, we query by foreign key
    // For BelongsTo, we query by the owner key
    const relationType = relation.constructor.name;
    
    if (relationType === 'HasMany' || relationType === 'HasOne') {
      relatedQuery.whereIn(foreignKey, parentKeys);
    } else if (relationType === 'BelongsTo') {
      // For BelongsTo, collect the foreign key values from parents
      const foreignKeys = models.map((model: any) => model.get(foreignKey)).filter((fk: any) => fk != null);
      if (foreignKeys.length > 0) {
        relatedQuery.whereIn('id', foreignKeys);
      } else {
        return;
      }
    } else if (relationType === 'BelongsToMany') {
      // BelongsToMany requires joining through pivot table
      // This is more complex and will be handled separately
      return;
    }

    const relatedModels = relatedQuery.get();
    
    // Group related models by their foreign key
    const grouped: Record<string, any[]> = {};
    
    if (relationType === 'BelongsTo') {
      // For BelongsTo, key by the model's own ID
      for (const relatedRow of relatedModels) {
        const key = relatedRow.id || relatedRow[relation.ownerKey || 'id'];
        grouped[key] = [relatedRow];
      }
    } else {
      // For HasMany/HasOne, key by foreign key value
      for (const relatedRow of relatedModels) {
        const key = relatedRow[foreignKey];
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(relatedRow);
      }
    }

    // Attach related models to parent models
    for (const model of models) {
      let related;
      
      if (relationType === 'BelongsTo') {
        const fkValue = model.get(foreignKey);
        const relatedRows = grouped[fkValue] || [];
        related = relatedRows.length > 0 ? relation.hydrateOne(relatedRows[0]) : null;
      } else if (relationType === 'HasOne') {
        const parentKey = model.get('id');
        const relatedRows = grouped[parentKey] || [];
        related = relatedRows.length > 0 ? relation.hydrateOne(relatedRows[0]) : null;
      } else if (relationType === 'HasMany') {
        const parentKey = model.get('id');
        const relatedRows = grouped[parentKey] || [];
        related = relation.hydrate(relatedRows);
      }
      
      model.setRelation(relationName, related);
    }
  }

  /**
   * Get the first result
   */
  public first(): any {
    this.limitValue = 1;
    const { sql, params } = this.buildSelectQuery();
    return this.connection.queryOne(sql, params);
  }

  /**
   * Find a record by ID
   */
  public find(id: number | string): any {
    return this.where("id", "=", id).first();
  }

  /**
   * Get count of records
   */
  public count(): number {
    const originalSelect = this.selectColumns;
    this.selectColumns = ["COUNT(*) as count"];
    const { sql, params } = this.buildSelectQuery();
    this.selectColumns = originalSelect;
    const result = this.connection.queryOne(sql, params);
    return result?.count ?? 0;
  }

  /**
   * Paginate the query results
   */
  public paginate(perPage: number = 15, page: number = 1): Paginator {
    // Get total count
    const total = this.count();
    
    // Calculate offset
    const offset = (page - 1) * perPage;
    
    // Get paginated results
    const items = this.limit(perPage).offset(offset).get();
    
    return new Paginator(items, total, perPage, page);
  }

  /**
   * Insert a record
   */
  public insert(data: Record<string, any>): number {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => "?").join(", ");
    
    const sql = `INSERT INTO ${this.tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
    const result = this.connection.execute(sql, values);
    return result.lastInsertRowid;
  }

  /**
   * Update records
   */
  public update(data: Record<string, any>): number {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setParts = columns.map(col => `${col} = ?`).join(", ");
    
    let sql = `UPDATE ${this.tableName} SET ${setParts}`;
    const params: any[] = [...values];

    // Add WHERE clauses
    if (this.whereConditions.length > 0) {
      const whereParts: string[] = [];
      for (const condition of this.whereConditions) {
        whereParts.push(`${condition.column} ${condition.operator} ?`);
        params.push(condition.value);
      }
      sql += ` WHERE ${whereParts.join(" AND ")}`;
    }

    const result = this.connection.execute(sql, params);
    return result.changes;
  }

  /**
   * Delete records
   */
  public delete(): number {
    let sql = `DELETE FROM ${this.tableName}`;
    const params: any[] = [];

    // Add WHERE clauses
    if (this.whereConditions.length > 0) {
      const whereParts: string[] = [];
      for (const condition of this.whereConditions) {
        if (condition.operator === "IN" && Array.isArray(condition.value)) {
          // Handle IN clause with multiple values
          const placeholders = condition.value.map(() => "?").join(", ");
          whereParts.push(`${condition.column} IN (${placeholders})`);
          params.push(...condition.value);
        } else if (condition.operator === "IS NULL" || condition.operator === "IS NOT NULL") {
          // Handle IS NULL / IS NOT NULL without parameters
          whereParts.push(`${condition.column} ${condition.operator}`);
        } else {
          whereParts.push(`${condition.column} ${condition.operator} ?`);
          params.push(condition.value);
        }
      }
      sql += ` WHERE ${whereParts.join(" AND ")}`;
    }

    const result = this.connection.execute(sql, params);
    return result.changes;
  }

  /**
   * Check if a record exists
   */
  public exists(): boolean {
    return this.count() > 0;
  }
}
