import { DatabaseConnection } from "./Connection";
import { Seeder } from "./Seeder";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Seeder Manager
 * Handles running database seeders
 */
export class SeederManager {
  private db: DatabaseConnection;
  private seedersPath: string;

  constructor(db: DatabaseConnection, seedersPath: string = "database/seeders") {
    this.db = db;
    this.seedersPath = seedersPath;
  }

  /**
   * Run a specific seeder
   */
  async run(seederName: string = "DatabaseSeeder"): Promise<void> {
    // Handle both absolute and relative paths
    const seederPath = this.seedersPath.startsWith("/")
      ? join(this.seedersPath, `${seederName}.ts`)
      : join(process.cwd(), this.seedersPath, `${seederName}.ts`);

    if (!existsSync(seederPath)) {
      throw new Error(`Seeder file not found: ${seederPath}`);
    }

    try {
      // Import the seeder dynamically
      const module = await import(seederPath);
      const SeederClass = module.default || module[seederName];

      if (!SeederClass) {
        throw new Error(`Seeder class not found in ${seederPath}`);
      }

      // Instantiate and run the seeder
      const seeder: Seeder = new SeederClass();
      
      console.log(`\n🌱 Seeding: ${seederName}`);
      await seeder.run(this.db);
      console.log(`✅ Seeded: ${seederName}`);
    } catch (error) {
      console.error(`❌ Failed to run seeder: ${seederName}`);
      throw error;
    }
  }

  /**
   * Run all seeders in the seeders directory
   */
  async runAll(): Promise<void> {
    // For now, just run DatabaseSeeder which should call other seeders
    await this.run("DatabaseSeeder");
  }

  /**
   * Get the database connection
   */
  getConnection(): DatabaseConnection {
    return this.db;
  }
}
