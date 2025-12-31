import { Controller } from "../../src/core/Controller";

export class WelcomeController extends Controller {
  public async index(request: Request): Promise<Response> {
    return this.json({
      message: "Welcome to Bunavel!",
      framework: "Laravel-inspired framework for Bun",
      version: "0.1.0",
    });
  }

  public async show(request: Request, params: Record<string, string>): Promise<Response> {
    const { name } = params;
    return this.json({
      message: `Hello, ${name}!`,
    });
  }

  public async store(request: Request): Promise<Response> {
    const body = await this.getJsonBody<{ name: string }>(request);
    
    return this.json({
      message: "Data received",
      data: body,
    }, 201);
  }
}
