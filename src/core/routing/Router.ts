import type { Middleware } from "../middleware/Middleware";

export type RouteHandler = (req: Request, params: Record<string, string>) => Promise<Response> | Response;

export interface Route {
  method: string;
  path: string;
  pattern: RegExp;
  keys: string[];
  handler: RouteHandler;
  middleware: Middleware[];
  name?: string;
}

export interface GroupOptions {
  prefix?: string;
  middleware?: Middleware[];
  name?: string;
}

/**
 * Fluent builder returned by Router.get/post/put/patch/delete for attaching
 * middleware/a name to a single route after registration.
 */
export class RouteBuilder {
  private route: Route;
  private namePrefix: string;

  constructor(route: Route, namePrefix: string) {
    this.route = route;
    this.namePrefix = namePrefix;
  }

  public middleware(...middleware: Middleware[]): this {
    this.route.middleware.push(...middleware);
    return this;
  }

  public name(name: string): this {
    this.route.name = this.namePrefix + name;
    return this;
  }
}

export class Router {
  private routes: Route[] = [];
  private groupStack: GroupOptions[] = [];

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

  /**
   * Join path segments, normalizing slashes (no double or missing slashes)
   */
  private joinPaths(...segments: string[]): string {
    const cleaned = segments
      .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
      .filter((segment) => segment.length > 0);
    return "/" + cleaned.join("/");
  }

  /**
   * Group routes under a shared prefix, middleware, and/or name prefix.
   * Nestable — each enclosing group's options accumulate outer to inner.
   */
  public group(options: GroupOptions, callback: (router: Router) => void): void {
    this.groupStack.push(options);
    callback(this);
    this.groupStack.pop();
  }

  public add(method: string, path: string, handler: RouteHandler): RouteBuilder {
    const fullPath = this.joinPaths(
      ...this.groupStack.map((group) => group.prefix ?? ""),
      path
    );
    const { pattern, keys } = this.pathToRegex(fullPath);
    const middleware: Middleware[] = this.groupStack.flatMap((group) => group.middleware ?? []);
    const namePrefix = this.groupStack.map((group) => group.name ?? "").join("");

    const route: Route = {
      method: method.toUpperCase(),
      path: fullPath,
      pattern,
      keys,
      handler,
      middleware,
    };
    this.routes.push(route);

    return new RouteBuilder(route, namePrefix);
  }

  public get(path: string, handler: RouteHandler): RouteBuilder {
    return this.add("GET", path, handler);
  }

  public post(path: string, handler: RouteHandler): RouteBuilder {
    return this.add("POST", path, handler);
  }

  public put(path: string, handler: RouteHandler): RouteBuilder {
    return this.add("PUT", path, handler);
  }

  public patch(path: string, handler: RouteHandler): RouteBuilder {
    return this.add("PATCH", path, handler);
  }

  public delete(path: string, handler: RouteHandler): RouteBuilder {
    return this.add("DELETE", path, handler);
  }

  public match(
    method: string,
    path: string
  ): { handler: RouteHandler; params: Record<string, string>; middleware: Middleware[] } | null {
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
        return { handler: route.handler, params, middleware: route.middleware };
      }
    }

    return null;
  }

  /**
   * Resolve a named route to a concrete path, substituting {param} placeholders
   */
  public route(name: string, params: Record<string, string | number> = {}): string {
    const route = this.routes.find((r) => r.name === name);
    if (!route) {
      throw new Error(`Route [${name}] not defined.`);
    }

    let path = route.path;
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`{${key}}`, String(value));
    }
    return path;
  }

  public getRoutes(): Route[] {
    return this.routes;
  }
}
