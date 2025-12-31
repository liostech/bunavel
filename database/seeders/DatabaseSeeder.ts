import { Seeder } from "../../src/core/database/Seeder";
import type { DatabaseConnection } from "../../src/core/database/Connection";

/**
 * DatabaseSeeder
 * Main seeder that calls other seeders
 */
export default class DatabaseSeeder extends Seeder {
  /**
   * Run the database seeds
   */
  async run(db: DatabaseConnection): Promise<void> {
    // Call other seeders here
    // await this.call(db, [UserSeeder, PostSeeder]);
    
    // Or seed directly
    console.log("  → Seeding users table...");
    
    // Example: Insert sample users
    const users = [
      { name: "John Doe", email: "john@example.com" },
      { name: "Jane Smith", email: "jane@example.com" },
      { name: "Bob Johnson", email: "bob@example.com" },
    ];

    for (const user of users) {
      db.query(
        "INSERT INTO users (name, email, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [user.name, user.email, new Date().toISOString(), new Date().toISOString()]
      );
    }

    console.log(`  → Inserted ${users.length} users`);
  }
}
