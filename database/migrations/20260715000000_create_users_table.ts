import { Migration } from "../../src/core/database/Migration";
import { Schema } from "../../src/core/database/Schema";

/**
 * CreateUsersTable Migration
 */
export default class CreateUsersTable extends Migration {
  /**
   * Run the migration
   */
  async up(): Promise<void> {
    await Schema.create("users", (table) => {
      table.id();
      table.string("name").notNullable();
      table.string("email").notNullable().unique();
      table.string("password").notNullable();
      table.timestamps();
    });
  }

  /**
   * Reverse the migration
   */
  async down(): Promise<void> {
    await Schema.dropIfExists("users");
  }
}
