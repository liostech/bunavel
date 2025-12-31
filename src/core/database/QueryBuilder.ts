import type { DatabaseConnection } from "./Connection";

export class QueryBuilder {
  private connection: DatabaseConnection;
  private tableName: string = "";
  private selectColumns: string[] = ["*"];
  private whereConditions: { column: string; operator: string; value: any }[] = [];
  private orderByColumns: { column: string; direction: "ASC" | "DESC" }[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private joinClauses: string[] = [];

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
   * Build the SQL query
   */
  private buildSelectQuery(): { sql: string; params: any[] } {
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
    return this.connection.query(sql, params);
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
        whereParts.push(`${condition.column} ${condition.operator} ?`);
        params.push(condition.value);
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
