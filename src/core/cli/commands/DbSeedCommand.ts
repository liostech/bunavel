import { Command } from "../Command";
import { DatabaseConnection } from "../../database/Connection";
import { SeederManager } from "../../database/SeederManager";
import { Env } from "../../config/Env";

/**
 * Database Seed command
 */
export class DbSeedCommand extends Command {
  name = "db:seed";
  description = "Seed the database with records";
  signature = "db:seed {--class=DatabaseSeeder}";

  async handle(args: string[], options: Record<string, any>): Promise<void> {
    try {
      this.info("🌱 Seeding database...\n");

      // Get database connection
      const dbDriver = Env.get("DB_DRIVER", "sqlite") as "sqlite" | "postgres" | "mysql";
      const db = new DatabaseConnection({
        driver: dbDriver,
        connection: {
          filename: Env.get("DB_FILENAME", "database/database.sqlite"),
          host: Env.get("DB_HOST"),
          port: Env.get("DB_PORT") ? parseInt(Env.get("DB_PORT")!) : undefined,
          database: Env.get("DB_DATABASE"),
          username: Env.get("DB_USERNAME"),
          password: Env.get("DB_PASSWORD"),
        },
      });

      db.connect();

      // Create seeder manager
      const seederManager = new SeederManager(db);

      // Get seeder class name
      const seederClass = options.class || "DatabaseSeeder";

      // Run the seeder
      await seederManager.run(seederClass);

      this.success("\n✅ Database seeding completed successfully!");
    } catch (error) {
      this.error(`\n❌ Seeding failed: ${(error as Error).message}`);
      throw error;
    }
  }
}
