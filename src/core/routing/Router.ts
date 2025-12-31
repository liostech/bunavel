export type RouteHandler = (req: Request, params: Record<string, string>) => Promise<Response> | Response;

export interface Route {
  method: string;
  path: string;
  pattern: RegExp;
  keys: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];

  private pathToRegex(path: string): { pattern: RegExp; keys: string[] } {
    const keys: string[] = [];
    
    // Convert Laravel-style {param} to regex
    const pattern = path
      .replace(/\{([^}]+)\}/g, (_, key) => {
        keys.push(key);
        return "([^/]+)";
      })
      .replace(/\//g, "\\/");

    return {
      pattern: new RegExp(`^${pattern}$`),
      keys,
    };
  }

  public add(method: string, path: string, handler: RouteHandler): void {
    const { pattern, keys } = this.pathToRegex(path);
    this.routes.push({
      method: method.toUpperCase(),
      path,
      pattern,
      keys,
      handler,
    });
  }

  public get(path: string, handler: RouteHandler): void {
    this.add("GET", path, handler);
  }

  public post(path: string, handler: RouteHandler): void {
    this.add("POST", path, handler);
  }

  public put(path: string, handler: RouteHandler): void {
    this.add("PUT", path, handler);
  }

  public patch(path: string, handler: RouteHandler): void {
    this.add("PATCH", path, handler);
  }

  public delete(path: string, handler: RouteHandler): void {
    this.add("DELETE", path, handler);
  }

  public match(method: string, path: string): { handler: RouteHandler; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) {
        continue;
      }

      const match = path.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        route.keys.forEach((key, index) => {
          params[key] = match[index + 1] ?? "";
        });
        return { handler: route.handler, params };
      }
    }

    return null;
  }

  public getRoutes(): Route[] {
    return this.routes;
  }
}
