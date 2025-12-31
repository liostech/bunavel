import { Command } from "../Command";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { Str } from "../../support/Str";

/**
 * Make Controller command
 */
export class MakeControllerCommand extends Command {
  name = "make:controller";
  description = "Create a new controller class";
  signature = "make:controller {name} {--resource}";

  async handle(args: string[], options: Record<string, any>): Promise<void> {
    const name = args[0];
    
    if (!name) {
      this.error("Controller name is required");
      return;
    }

    // Ensure name ends with "Controller"
    const className = name.endsWith("Controller") ? name : `${name}Controller`;
    const fileName = `${className}.ts`;
    const filePath = join(process.cwd(), "app", "controllers", fileName);

    // Check if file already exists
    if (existsSync(filePath)) {
      this.error(`Controller ${className} already exists!`);
      return;
    }

    // Create directory if it doesn't exist
    const dir = join(process.cwd(), "app", "controllers");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Generate controller content
    const content = options.resource
      ? this.generateResourceController(className)
      : this.generateController(className);

    // Write file
    try {
      writeFileSync(filePath, content);
      this.success(`Controller created successfully: app/controllers/${fileName}`);
      
      if (options.resource) {
        this.info("Resource controller created with: index, show, store, update, destroy methods");
      }
    } catch (error) {
      this.error(`Failed to create controller: ${(error as Error).message}`);
    }
  }

  /**
   * Generate basic controller template
   */
  private generateController(className: string): string {
    return `import { Controller } from "../../src/core/Controller";
import { HttpRequest } from "../../src/core/http/Request";
import { HttpResponse } from "../../src/core/http/Response";

/**
 * ${className}
 */
export class ${className} extends Controller {
  /**
   * Handle the request
   */
  async index(req: HttpRequest, res: HttpResponse): Promise<Response> {
    return res.json({
      message: "Hello from ${className}",
    });
  }
}
`;
  }

  /**
   * Generate resource controller template
   */
  private generateResourceController(className: string): string {
    const resourceName = className.replace("Controller", "").toLowerCase();
    
    return `import { Controller } from "../../src/core/Controller";
import { HttpRequest } from "../../src/core/http/Request";
import { HttpResponse } from "../../src/core/http/Response";

/**
 * ${className} - Resource Controller
 */
export class ${className} extends Controller {
  /**
   * Display a listing of the resource
   */
  async index(req: HttpRequest, res: HttpResponse): Promise<Response> {
    // TODO: Fetch all ${resourceName}s from database
    return res.json({
      data: [],
    });
  }

  /**
   * Display the specified resource
   */
  async show(req: HttpRequest, res: HttpResponse): Promise<Response> {
    const id = req.param("id");
    
    // TODO: Fetch ${resourceName} by ID from database
    return res.json({
      data: { id },
    });
  }

  /**
   * Store a newly created resource
   */
  async store(req: HttpRequest, res: HttpResponse): Promise<Response> {
    const data = req.body;
    
    // TODO: Validate and save ${resourceName} to database
    return res.json({
      message: "${Str.title(resourceName)} created successfully",
      data,
    }, 201);
  }

  /**
   * Update the specified resource
   */
  async update(req: HttpRequest, res: HttpResponse): Promise<Response> {
    const id = req.param("id");
    const data = req.body;
    
    // TODO: Validate and update ${resourceName} in database
    return res.json({
      message: "${Str.title(resourceName)} updated successfully",
      data: { id, ...data },
    });
  }

  /**
   * Remove the specified resource
   */
  async destroy(req: HttpRequest, res: HttpResponse): Promise<Response> {
    const id = req.param("id");
    
    // TODO: Delete ${resourceName} from database
    return res.json({
      message: "${Str.title(resourceName)} deleted successfully",
    });
  }
}
`;
  }
}
