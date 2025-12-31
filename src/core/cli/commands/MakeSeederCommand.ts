import { Command } from "../Command";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { Str } from "../../support/Str";

/**
 * Make Seeder command
 */
export class MakeSeederCommand extends Command {
  name = "make:seeder";
  description = "Create a new seeder class";
  signature = "make:seeder {name}";

  async handle(args: string[], options: Record<string, any>): Promise<void> {
    const name = args[0];
    
    if (!name) {
      this.error("Seeder name is required");
      return;
    }

    // Ensure name ends with 'Seeder' and is PascalCase
    let className = Str.studly(name);
    if (!className.endsWith("Seeder")) {
      className += "Seeder";
    }

    const fileName = `${className}.ts`;
    const filePath = join(process.cwd(), "database", "seeders", fileName);

    // Check if file already exists
    if (existsSync(filePath)) {
      this.error(`Seeder ${className} already exists!`);
      return;
    }

    // Create directory if it doesn't exist
    const dir = join(process.cwd(), "database", "seeders");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Generate seeder content
    const content = this.generateSeeder(className);

    // Write file
    try {
      writeFileSync(filePath, content);
      this.success(`Seeder created successfully: database/seeders/${fileName}`);
    } catch (error) {
      this.error(`Failed to create seeder: ${(error as Error).message}`);
    }
  }

  /**
   * Generate seeder template
   */
  private generateSeeder(className: string): string {
    return `import { Seeder } from "../../src/core/database/Seeder";
import type { DatabaseConnection } from "../../src/core/database/Connection";

/**
 * ${className}
 */
export default class ${className} extends Seeder {
  /**
   * Run the database seeds
   */
  async run(db: DatabaseConnection): Promise<void> {
    // Insert seed data here
    // Example:
    // await db.query(
    //   "INSERT INTO users (name, email) VALUES ($1, $2)",
    //   ["John Doe", "john@example.com"]
    // );
  }
}
`;
  }
}
