import { Command } from "../Command";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { Str } from "../../support/Str";

/**
 * Make Migration command
 */
export class MakeMigrationCommand extends Command {
  name = "make:migration";
  description = "Create a new migration file";
  signature = "make:migration {name} {--create=} {--table=}";

  async handle(args: string[], options: Record<string, any>): Promise<void> {
    const name = args[0];
    
    if (!name) {
      this.error("Migration name is required");
      return;
    }

    // Generate timestamp-based filename
    const timestamp = this.getTimestamp();
    const fileName = `${timestamp}_${Str.snake(name)}.ts`;
    const filePath = join(process.cwd(), "database", "migrations", fileName);

    // Check if directory exists
    const dir = join(process.cwd(), "database", "migrations");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Generate migration content
    let content: string;
    
    if (options.create) {
      // Create table migration
      content = this.generateCreateMigration(name, options.create);
    } else if (options.table) {
      // Alter table migration
      content = this.generateTableMigration(name, options.table);
    } else {
      // Blank migration
      content = this.generateBlankMigration(name);
    }

    // Write file
    try {
      writeFileSync(filePath, content);
      this.success(`Migration created successfully: database/migrations/${fileName}`);
    } catch (error) {
      this.error(`Failed to create migration: ${(error as Error).message}`);
    }
  }

  /**
   * Get timestamp for migration filename
   */
  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Generate create table migration
   */
  private generateCreateMigration(name: string, tableName: string): string {
    const className = Str.studly(name);
    
    return `import { Migration } from "../../src/core/database/Migration";
import { Schema } from "../../src/core/database/Schema";

/**
 * ${className} Migration
 */
export default class ${className} extends Migration {
  /**
   * Run the migration
   */
  async up(): Promise<void> {
    await Schema.create("${tableName}", (table) => {
      table.id();
      table.timestamps();
    });
  }

  /**
   * Reverse the migration
   */
  async down(): Promise<void> {
    await Schema.dropIfExists("${tableName}");
  }
}
`;
  }

  /**
   * Generate alter table migration
   */
  private generateTableMigration(name: string, tableName: string): string {
    const className = Str.studly(name);
    
    return `import { Migration } from "../../src/core/database/Migration";
import { Schema } from "../../src/core/database/Schema";

/**
 * ${className} Migration
 */
export default class ${className} extends Migration {
  /**
   * Run the migration
   */
  async up(): Promise<void> {
    // Add your table alterations here
    // Note: SQLite has limited ALTER TABLE support
    // You may need to recreate the table for complex changes
  }

  /**
   * Reverse the migration
   */
  async down(): Promise<void> {
    // Reverse your table alterations here
  }
}
`;
  }

  /**
   * Generate blank migration
   */
  private generateBlankMigration(name: string): string {
    const className = Str.studly(name);
    
    return `import { Migration } from "../../src/core/database/Migration";
import { Schema } from "../../src/core/database/Schema";

/**
 * ${className} Migration
 */
export default class ${className} extends Migration {
  /**
   * Run the migration
   */
  async up(): Promise<void> {
    // Write your migration code here
  }

  /**
   * Reverse the migration
   */
  async down(): Promise<void> {
    // Write your rollback code here
  }
}
`;
  }
}
