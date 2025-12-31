import { DatabaseConnection } from "./Connection";

/**
 * Column definition for Schema builder
 */
export class ColumnDefinition {
  private columnName: string;
  private columnType: string;
  private constraints: string[] = [];

  constructor(name: string, type: string) {
    this.columnName = name;
    this.columnType = type;
  }

  /**
   * Make column nullable
   */
  nullable(): this {
    this.constraints.push("NULL");
    return this;
  }

  /**
   * Make column not nullable
   */
  notNullable(): this {
    this.constraints.push("NOT NULL");
    return this;
  }

  /**
   * Set default value
   */
  default(value: any): this {
    const formattedValue = typeof value === "string" ? `'${value}'` : value;
    this.constraints.push(`DEFAULT ${formattedValue}`);
    return this;
  }

  /**
   * Make column unique
   */
  unique(): this {
    this.constraints.push("UNIQUE");
    return this;
  }

  /**
   * Make column primary key
   */
  primary(): this {
    this.constraints.push("PRIMARY KEY");
    return this;
  }

  /**
   * Make column auto increment
   */
  autoIncrement(): this {
    this.constraints.push("AUTOINCREMENT");
    return this;
  }

  /**
   * Build the column definition SQL
   */
  toSQL(): string {
    return `${this.columnName} ${this.columnType} ${this.constraints.join(" ")}`.trim();
  }
}

/**
 * Blueprint for building table schema
 */
export class Blueprint {
  private tableName: string;
  private columns: ColumnDefinition[] = [];
  private indexes: string[] = [];
  private foreignKeys: string[] = [];

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Get table name
   */
  getTableName(): string {
    return this.tableName;
  }

  /**
   * Add auto-incrementing ID column
   */
  id(name: string = "id"): ColumnDefinition {
    const col = new ColumnDefinition(name, "INTEGER");
    col.primary().autoIncrement().notNullable();
    this.columns.push(col);
    return col;
  }

  /**
   * Add string column
   */
  string(name: string, length: number = 255): ColumnDefinition {
    const col = new ColumnDefinition(name, `VARCHAR(${length})`);
    this.columns.push(col);
    return col;
  }

  /**
   * Add text column
   */
  text(name: string): ColumnDefinition {
    const col = new ColumnDefinition(name, "TEXT");
    this.columns.push(col);
    return col;
  }

  /**
   * Add integer column
   */
  integer(name: string): ColumnDefinition {
    const col = new ColumnDefinition(name, "INTEGER");
    this.columns.push(col);
    return col;
  }

  /**
   * Add big integer column
   */
  bigInteger(name: string): ColumnDefinition {
    const col = new ColumnDefinition(name, "BIGINT");
    this.columns.push(col);
    return col;
  }

  /**
   * Add float column
   */
  float(name: string): ColumnDefinition {
    const col = new ColumnDefinition(name, "REAL");
    this.columns.push(col);
    return col;
  }

  /**
   * Add double column
   */
  double(name: string): ColumnDefinition {
    const col = new ColumnDefinition(name, "DOUBLE");
    this.columns.push(col);
    return col;
  }

  /**
   * Add decimal column
   */
  decimal(name: string, precision: number = 8, scale: number = 2): ColumnDefinition {
    const col = new ColumnDefinition(name, `DECIMAL(${precision}, ${scale})`);
    this.columns.push(col);
    return col;
  }

  /**
   * Add boolean column
   */
  boolean(name: string): ColumnDefinition {
    const col = new ColumnDefinition(name, "BOOLEAN");
    this.columns.push(col);
    return col;
  }

  /**
   * Add date column
   */
  date(name: string): ColumnDefinition {
    const col = new ColumnDefinition(name, "DATE");
    this.columns.push(col);
    return col;
  }

  /**
   * Add datetime column
   */
  datetime(name: string): ColumnDefinition {
    const col = new ColumnDefinition(name, "DATETIME");
    this.columns.push(col);
    return col;
  }

  /**
   * Add timestamp column
   */
  timestamp(name: string): ColumnDefinition {
    const col = new ColumnDefinition(name, "TIMESTAMP");
    this.columns.push(col);
    return col;
  }

  /**
   * Add timestamps (created_at, updated_at)
   */
  timestamps(): void {
    this.timestamp("created_at").default("CURRENT_TIMESTAMP").notNullable();
    this.timestamp("updated_at").default("CURRENT_TIMESTAMP").notNullable();
  }

  /**
   * Add foreign key constraint
   */
  foreign(column: string): { references: (refColumn: string) => { on: (refTable: string) => void } } {
    const self = this;
    return {
      references(refColumn: string) {
        return {
          on(refTable: string) {
            self.foreignKeys.push(
              `FOREIGN KEY (${column}) REFERENCES ${refTable}(${refColumn})`
            );
          },
        };
      },
    };
  }

  /**
   * Add index
   */
  index(columns: string | string[], indexName?: string): void {
    const cols = Array.isArray(columns) ? columns.join(", ") : columns;
    const name = indexName || `${this.tableName}_${cols.replace(/,\s*/g, "_")}_index`;
    this.indexes.push(`CREATE INDEX ${name} ON ${this.tableName} (${cols})`);
  }

  /**
   * Build CREATE TABLE SQL
   */
  toSQL(): string[] {
    const columnDefs = this.columns.map(col => col.toSQL()).join(",\n  ");
    const foreignKeyDefs = this.foreignKeys.length > 0 
      ? ",\n  " + this.foreignKeys.join(",\n  ")
      : "";

    const createTable = `CREATE TABLE ${this.tableName} (\n  ${columnDefs}${foreignKeyDefs}\n)`;
    
    return [createTable, ...this.indexes];
  }
}

/**
 * Schema builder for database migrations
 */
export class Schema {
  private static connection?: DatabaseConnection;

  /**
   * Set database connection
   */
  static setConnection(connection: DatabaseConnection): void {
    Schema.connection = connection;
  }

  /**
   * Get database connection
   */
  static getConnection(): DatabaseConnection {
    if (!Schema.connection) {
      throw new Error("Database connection not set for Schema builder");
    }
    return Schema.connection;
  }

  /**
   * Create a new table
   */
  static async create(tableName: string, callback: (table: Blueprint) => void): Promise<void> {
    const blueprint = new Blueprint(tableName);
    callback(blueprint);

    const statements = blueprint.toSQL();
    const db = Schema.getConnection();

    for (const statement of statements) {
      await db.execute(statement);
    }
  }

  /**
   * Drop a table if it exists
   */
  static async dropIfExists(tableName: string): Promise<void> {
    const db = Schema.getConnection();
    await db.execute(`DROP TABLE IF EXISTS ${tableName}`);
  }

  /**
   * Drop a table
   */
  static async drop(tableName: string): Promise<void> {
    const db = Schema.getConnection();
    await db.execute(`DROP TABLE ${tableName}`);
  }

  /**
   * Check if table exists
   */
  static async hasTable(tableName: string): Promise<boolean> {
    const db = Schema.getConnection();
    const result = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName]
    );
    return result.length > 0;
  }

  /**
   * Rename a table
   */
  static async rename(from: string, to: string): Promise<void> {
    const db = Schema.getConnection();
    await db.execute(`ALTER TABLE ${from} RENAME TO ${to}`);
  }
}
