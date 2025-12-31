import { Command } from "../Command";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { Str } from "../../support/Str";

/**
 * Make Model command
 */
export class MakeModelCommand extends Command {
  name = "make:model";
  description = "Create a new model class";
  signature = "make:model {name} {--table=}";

  async handle(args: string[], options: Record<string, any>): Promise<void> {
    const name = args[0];
    
    if (!name) {
      this.error("Model name is required");
      return;
    }

    // Ensure name is singular and PascalCase
    const className = Str.studly(Str.singular(name));
    const fileName = `${className}.ts`;
    const filePath = join(process.cwd(), "app", "models", fileName);

    // Check if file already exists
    if (existsSync(filePath)) {
      this.error(`Model ${className} already exists!`);
      return;
    }

    // Create directory if it doesn't exist
    const dir = join(process.cwd(), "app", "models");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Determine table name
    const tableName = options.table || Str.snake(Str.plural(className));

    // Generate model content
    const content = this.generateModel(className, tableName);

    // Write file
    try {
      writeFileSync(filePath, content);
      this.success(`Model created successfully: app/models/${fileName}`);
      this.info(`Table name: ${tableName}`);
    } catch (error) {
      this.error(`Failed to create model: ${(error as Error).message}`);
    }
  }

  /**
   * Generate model template
   */
  private generateModel(className: string, tableName: string): string {
    return `import { Model } from "../../src/core/database/Model";

/**
 * ${className} Model
 */
export class ${className} extends Model {
  /**
   * The table associated with the model
   */
  protected table = "${tableName}";

  /**
   * The primary key for the model
   */
  protected primaryKey = "id";

  /**
   * Define model properties
   */
  id?: number;
  created_at?: string;
  updated_at?: string;

  // Add your custom properties here
}
`;
  }
}
