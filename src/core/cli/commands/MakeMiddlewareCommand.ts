import { Command } from "../Command";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Make Middleware command
 */
export class MakeMiddlewareCommand extends Command {
  name = "make:middleware";
  description = "Create a new middleware class";
  signature = "make:middleware {name}";

  async handle(args: string[], options: Record<string, any>): Promise<void> {
    const name = args[0];
    
    if (!name) {
      this.error("Middleware name is required");
      return;
    }

    // Ensure name ends with "Middleware"
    const className = name.endsWith("Middleware") ? name : `${name}Middleware`;
    const fileName = `${className}.ts`;
    const filePath = join(process.cwd(), "app", "middleware", fileName);

    // Check if file already exists
    if (existsSync(filePath)) {
      this.error(`Middleware ${className} already exists!`);
      return;
    }

    // Create directory if it doesn't exist
    const dir = join(process.cwd(), "app", "middleware");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Generate middleware content
    const content = this.generateMiddleware(className);

    // Write file
    try {
      writeFileSync(filePath, content);
      this.success(`Middleware created successfully: app/middleware/${fileName}`);
      this.info("Don't forget to register your middleware in the application!");
    } catch (error) {
      this.error(`Failed to create middleware: ${(error as Error).message}`);
    }
  }

  /**
   * Generate middleware template
   */
  private generateMiddleware(className: string): string {
    return `import { BaseMiddleware } from "../../src/core/middleware/Middleware";

/**
 * ${className}
 */
export class ${className} extends BaseMiddleware {
  /**
   * Handle an incoming request
   */
  async handle(req: Request, next: () => Promise<Response>): Promise<Response> {
    // Logic before the request is handled
    console.log(\`${className}: Processing request to \${new URL(req.url).pathname}\`);

    // Call the next middleware or route handler
    const response = await next();

    // Logic after the request is handled
    // You can modify the response here if needed

    return response;
  }
}
`;
  }
}
