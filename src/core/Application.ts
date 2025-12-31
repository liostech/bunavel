import type { Server } from "bun";
import { Router } from "./routing/Router";
import { Container } from "./container/Container";
import type { Middleware } from "./middleware/Middleware";
import { ExceptionHandler } from "./exceptions/ExceptionHandler";
import { HttpRequest } from "./http/Request";
import { NotFoundException } from "./exceptions/HttpException";

export class Application {
  private router: Router;
  private container: Container;
  private server?: Server<unknown>;
  private middleware: Middleware[] = [];
  private config: Record<string, any> = {};
  private exceptionHandler: ExceptionHandler;

  constructor() {
    this.router = new Router();
    this.container = new Container();
    this.exceptionHandler = new ExceptionHandler();
    this.bootstrapCore();
  }

  private bootstrapCore(): void {
    // Register core services
    this.container.singleton("router", () => this.router);
    this.container.singleton("app", () => this);
  }

  public setConfig(config: Record<string, any>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  public getConfig(key: string, defaultValue?: any): any {
    return this.config[key] ?? defaultValue;
  }

  public getRouter(): Router {
    return this.router;
  }

  public getContainer(): Container {
    return this.container;
  }

  public use(middleware: Middleware): this {
    this.middleware.push(middleware);
    return this;
  }

  public async serve(port: number = 3000): Promise<void> {
    const router = this.router;
    const middleware = this.middleware;
    const exceptionHandler = this.exceptionHandler;

    this.server = Bun.serve({
      port,
      async fetch(req: Request): Promise<Response> {
        try {
          const url = new URL(req.url);
          const method = req.method;

          // Execute middleware chain
          let request = req;
          for (const mw of middleware) {
            const result = await mw.handle(request);
            if (result instanceof Response) {
              return result;
            }
            request = result;
          }

          // Route the request
          const route = router.match(method, url.pathname);
          
          if (!route) {
            throw new NotFoundException(`Route not found: ${method} ${url.pathname}`);
          }

          // Execute route handler
          const response = await route.handler(request, route.params);
          return response;
        } catch (error) {
          // Handle exceptions using the exception handler
          const httpRequest = new HttpRequest(req);
          return exceptionHandler.handle(error as Error, httpRequest);
        }
      },
    });

    console.log(`🚀 Bunavel server running at http://localhost:${port}`);
  }

  public async stop(): Promise<void> {
    if (this.server) {
      this.server.stop();
      console.log("Server stopped");
    }
  }
}
