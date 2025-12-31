import { Database } from "bun:sqlite";

export interface DatabaseConfig {
  driver: "sqlite" | "postgres" | "mysql";
  connection: {
    filename?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
  };
}

export class DatabaseConnection {
  private db: Database | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Connect to the database
   */
  public connect(): void {
    if (this.config.driver === "sqlite") {
      const filename = this.config.connection.filename || ":memory:";
      this.db = new Database(filename);
    } else {
      throw new Error(`Database driver ${this.config.driver} is not yet supported`);
    }
  }

  /**
   * Get the database instance
   */
  public getDb(): Database {
    if (!this.db) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.db;
  }

  /**
   * Execute a raw query
   */
  public query(sql: string, params: any[] = []): any[] {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Execute a query and get first result
   */
  public queryOne(sql: string, params: any[] = []): any {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  }

  /**
   * Execute a statement (INSERT, UPDATE, DELETE)
   */
  public execute(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  /**
   * Close the database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
