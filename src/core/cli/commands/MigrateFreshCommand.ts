import { Command } from "../Command";
import { DatabaseConnection } from "../../database/Connection";
import { Migrator } from "../../database/Migrator";

/**
 * Migrate Fresh command - Drop all tables and re-run migrations
 */
export class MigrateFreshCommand extends Command {
  name = "migrate:fresh";
  description = "Drop all tables and re-run all migrations";
  signature = "migrate:fresh";

  async handle(args: string[], options: Record<string, any>): Promise<void> {
    try {
      // Connect to database
      const connection = new DatabaseConnection({
        driver: "sqlite",
        connection: {
          filename: "./database.sqlite",
        },
      });
      connection.connect();

      // Fresh migration
      const migrator = new Migrator(connection);
      await migrator.fresh();
      
    } catch (error) {
      this.error(`Fresh migration failed: ${(error as Error).message}`);
      process.exit(1);
    }
  }
}
