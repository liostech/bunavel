import { Command } from "../Command";
import { DatabaseConnection } from "../../database/Connection";
import { Migrator } from "../../database/Migrator";

/**
 * Migrate Status command - Show migration status
 */
export class MigrateStatusCommand extends Command {
  name = "migrate:status";
  description = "Show the status of each migration";
  signature = "migrate:status";

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

      // Get status
      const migrator = new Migrator(connection);
      const status = await migrator.status();
      
      if (status.length === 0) {
        this.info("No migrations found");
        return;
      }

      // Display status table
      console.log("\n\x1b[33m╔════════════════════════════════════════════════════════════════════╗");
      console.log("║                      Migration Status                               ║");
      console.log("╚════════════════════════════════════════════════════════════════════╝\x1b[0m\n");

      const statusWidth = 10;
      const batchWidth = 8;
      const nameWidth = 50;

      console.log(
        `\x1b[32m${this.pad("Status", statusWidth)} ${this.pad("Batch", batchWidth)} ${this.pad("Migration", nameWidth)}\x1b[0m`
      );
      console.log("─".repeat(statusWidth + batchWidth + nameWidth + 4));

      for (const item of status) {
        const statusText = item.ran ? "\x1b[32mRan\x1b[0m" : "\x1b[33mPending\x1b[0m";
        const batch = item.batch ? item.batch.toString() : "-";
        
        console.log(
          `${statusText}${" ".repeat(statusWidth - 3)} ${this.pad(batch, batchWidth)} ${this.pad(item.migration, nameWidth)}`
        );
      }

      console.log();
      
    } catch (error) {
      this.error(`Failed to get status: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  /**
   * Pad string to specified width
   */
  private pad(str: string, width: number): string {
    if (str.length >= width) {
      return str.substring(0, width - 3) + "...";
    }
    return str + " ".repeat(width - str.length);
  }
}
