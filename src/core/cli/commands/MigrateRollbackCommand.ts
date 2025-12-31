import { Command } from "../Command";
import { DatabaseConnection } from "../../database/Connection";
import { Migrator } from "../../database/Migrator";

/**
 * Migrate Rollback command
 */
export class MigrateRollbackCommand extends Command {
  name = "migrate:rollback";
  description = "Rollback the last database migration";
  signature = "migrate:rollback {--step=1}";

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

      // Rollback migrations
      const migrator = new Migrator(connection);
      const steps = parseInt(options.step || "1", 10);
      await migrator.rollback(steps);
      
    } catch (error) {
      this.error(`Rollback failed: ${(error as Error).message}`);
      process.exit(1);
    }
  }
}
