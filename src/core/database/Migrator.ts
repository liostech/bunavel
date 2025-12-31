import { DatabaseConnection } from "./Connection";
import { Schema } from "./Schema";
import { Migration } from "./Migration";
import { readdirSync } from "fs";
import { join } from "path";

/**
 * Migration record in database
 */
export interface MigrationRecord {
  id: number;
  migration: string;
  batch: number;
}

/**
 * Migrator - handles running and rolling back migrations
 */
export class Migrator {
  private connection: DatabaseConnection;
  private migrationsPath: string;

  constructor(connection: DatabaseConnection, migrationsPath?: string) {
    this.connection = connection;
    this.migrationsPath = migrationsPath || join(process.cwd(), "database", "migrations");
    Schema.setConnection(connection);
  }

  /**
   * Create migrations table if it doesn't exist
   */
  async createMigrationsTable(): Promise<void> {
    const hasTable = await Schema.hasTable("migrations");
    
    if (!hasTable) {
      await Schema.create("migrations", (table) => {
        table.id();
        table.string("migration").notNullable();
        table.integer("batch").notNullable();
      });
    }
  }

  /**
   * Get all migration files
   */
  private getMigrationFiles(): string[] {
    try {
      return readdirSync(this.migrationsPath)
        .filter(file => file.endsWith(".ts") || file.endsWith(".js"))
        .sort(); // Sort by timestamp in filename
    } catch (error) {
      return [];
    }
  }

  /**
   * Get ran migrations from database
   */
  async getRanMigrations(): Promise<string[]> {
    await this.createMigrationsTable();
    
    const results = await this.connection.query(
      "SELECT migration FROM migrations ORDER BY batch, id"
    ) as MigrationRecord[];
    
    return results.map(r => r.migration);
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<string[]> {
    const allMigrations = this.getMigrationFiles();
    const ranMigrations = await this.getRanMigrations();
    
    return allMigrations.filter(m => !ranMigrations.includes(m));
  }

  /**
   * Get next batch number
   */
  async getNextBatchNumber(): Promise<number> {
    const result = await this.connection.query(
      "SELECT MAX(batch) as max_batch FROM migrations"
    ) as { max_batch: number | null }[];
    
    const maxBatch = result[0]?.max_batch;
    return (maxBatch || 0) + 1;
  }

  /**
   * Get last batch number
   */
  async getLastBatchNumber(): Promise<number> {
    const result = await this.connection.query(
      "SELECT MAX(batch) as max_batch FROM migrations"
    ) as { max_batch: number | null }[];
    
    return result[0]?.max_batch || 0;
  }

  /**
   * Get migrations from last batch
   */
  async getLastBatchMigrations(): Promise<MigrationRecord[]> {
    const lastBatch = await this.getLastBatchNumber();
    
    if (lastBatch === 0) {
      return [];
    }
    
    return await this.connection.query(
      "SELECT * FROM migrations WHERE batch = ? ORDER BY id DESC",
      [lastBatch]
    ) as MigrationRecord[];
  }

  /**
   * Load and instantiate a migration
   */
  private async loadMigration(filename: string): Promise<Migration> {
    const filePath = join(this.migrationsPath, filename);
    const module = await import(filePath);
    
    // Find the migration class (usually the default export or a named export)
    const MigrationClass = module.default || Object.values(module)[0];
    
    if (!MigrationClass) {
      throw new Error(`No migration class found in ${filename}`);
    }
    
    return new (MigrationClass as new () => Migration)();
  }

  /**
   * Run a single migration
   */
  async runMigration(filename: string, batch: number): Promise<void> {
    const migration = await this.loadMigration(filename);
    
    console.log(`  Running: ${filename}`);
    await migration.up();
    
    // Record migration
    await this.connection.execute(
      "INSERT INTO migrations (migration, batch) VALUES (?, ?)",
      [filename, batch]
    );
    
    console.log(`  \x1b[32m✓\x1b[0m Migrated: ${filename}`);
  }

  /**
   * Run all pending migrations
   */
  async run(): Promise<void> {
    await this.createMigrationsTable();
    
    const pending = await this.getPendingMigrations();
    
    if (pending.length === 0) {
      console.log("\x1b[33mNo pending migrations\x1b[0m");
      return;
    }
    
    const batch = await this.getNextBatchNumber();
    
    console.log(`\x1b[33mRunning ${pending.length} migration(s)...\x1b[0m\n`);
    
    for (const filename of pending) {
      await this.runMigration(filename, batch);
    }
    
    console.log(`\n\x1b[32m✓ Migrated ${pending.length} migration(s) successfully\x1b[0m`);
  }

  /**
   * Rollback a single migration
   */
  async rollbackMigration(filename: string): Promise<void> {
    const migration = await this.loadMigration(filename);
    
    console.log(`  Rolling back: ${filename}`);
    await migration.down();
    
    // Remove migration record
    await this.connection.execute(
      "DELETE FROM migrations WHERE migration = ?",
      [filename]
    );
    
    console.log(`  \x1b[32m✓\x1b[0m Rolled back: ${filename}`);
  }

  /**
   * Rollback last batch of migrations
   */
  async rollback(steps: number = 1): Promise<void> {
    await this.createMigrationsTable();
    
    const lastBatch = await this.getLastBatchMigrations();
    
    if (lastBatch.length === 0) {
      console.log("\x1b[33mNothing to rollback\x1b[0m");
      return;
    }
    
    console.log(`\x1b[33mRolling back ${lastBatch.length} migration(s)...\x1b[0m\n`);
    
    for (const record of lastBatch) {
      await this.rollbackMigration(record.migration);
    }
    
    console.log(`\n\x1b[32m✓ Rolled back ${lastBatch.length} migration(s) successfully\x1b[0m`);
  }

  /**
   * Reset all migrations
   */
  async reset(): Promise<void> {
    await this.createMigrationsTable();
    
    const ranMigrations = await this.getRanMigrations();
    
    if (ranMigrations.length === 0) {
      console.log("\x1b[33mNo migrations to reset\x1b[0m");
      return;
    }
    
    console.log(`\x1b[33mResetting ${ranMigrations.length} migration(s)...\x1b[0m\n`);
    
    // Rollback all migrations in reverse order
    for (const filename of ranMigrations.reverse()) {
      await this.rollbackMigration(filename);
    }
    
    console.log(`\n\x1b[32m✓ Reset ${ranMigrations.length} migration(s) successfully\x1b[0m`);
  }

  /**
   * Fresh migration - drop all tables and re-run migrations
   */
  async fresh(): Promise<void> {
    console.log("\x1b[33mDropping all tables...\x1b[0m\n");
    
    // Get all tables
    const tables = await this.connection.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ) as { name: string }[];
    
    // Drop all tables
    for (const table of tables) {
      await Schema.drop(table.name);
      console.log(`  Dropped: ${table.name}`);
    }
    
    console.log("\n\x1b[32m✓ All tables dropped\x1b[0m\n");
    
    // Run all migrations
    await this.run();
  }

  /**
   * Get migration status
   */
  async status(): Promise<{ migration: string; ran: boolean; batch?: number }[]> {
    await this.createMigrationsTable();
    
    const allMigrations = this.getMigrationFiles();
    const ranMigrations = await this.connection.query(
      "SELECT migration, batch FROM migrations ORDER BY batch, id"
    ) as MigrationRecord[];
    
    const ranMap = new Map(ranMigrations.map(m => [m.migration, m.batch]));
    
    return allMigrations.map(migration => ({
      migration,
      ran: ranMap.has(migration),
      batch: ranMap.get(migration),
    }));
  }
}
