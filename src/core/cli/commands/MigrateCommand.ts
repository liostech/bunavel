import { Command } from "../Command";
import { DatabaseConnection } from "../../database/Connection";
import { Migrator } from "../../database/Migrator";

/**
 * Migrate command - Run pending migrations
 */
export class MigrateCommand extends Command {
  name = "migrate";
  description = "Run database migrations";
  signature = "migrate";

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

      // Run migrations
      const migrator = new Migrator(connection);
      await migrator.run();
      
    } catch (error) {
      this.error(`Migration failed: ${(error as Error).message}`);
      process.exit(1);
    }
  }
}
