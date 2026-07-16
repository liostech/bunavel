# Route Groups, Prefixes & Named Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Laravel-style route grouping to Bunavel's `Router` — `prefix()`, per-group and per-route `middleware()`, `name()` + `route(name, params)` reverse resolution — and wire route-specific middleware into `Application.serve()`'s request lifecycle.

**Architecture:** `Router` gains a `groupStack` that `group(options, callback)` pushes/pops around a synchronous callback; `add()` reads the full stack at registration time to compute each route's full path, accumulated middleware, and name prefix. `get/post/put/patch/delete` now return a `RouteBuilder` for chaining `.middleware()`/`.name()` onto a single route. `Application.serve()` gets a second middleware pass — route-specific middleware — that runs after a route matches and before its handler, using the same short-circuit-on-Response semantics global middleware already has.

**Tech Stack:** Bun, TypeScript, `bun:test`, the existing `Router`/`Application`/`Middleware`/`BaseMiddleware` classes.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-route-groups-design.md` — read it if anything below is ambiguous.
- Run the full suite with `bun test` (currently 399 pass / 0 fail — must stay green after every task).
- `verbatimModuleSyntax` is enabled in `tsconfig.json` — any import used only as a type MUST use `import type { X }`.
- Backward compatibility is required: no existing route registration in `routes/web.ts` or elsewhere needs to change, and no existing test in `tests/unit/router.test.ts` may need modification — only additions.
- Group name concatenation is plain string concatenation, no automatic dot insertion (mirrors Laravel's own `name: "users."` trailing-dot convention).
- `router.route(name, params)` throws a plain `Error` (not an `HttpException`) for an unknown name, matching the existing `Container.make()` precedent for unbound-key lookups in this codebase.

---

## File Structure

Modified files:
- `src/core/routing/Router.ts` — add `GroupOptions`, `RouteBuilder`, `groupStack`, path/middleware/name accumulation in `add()`, `route()` reverse resolver, `middleware` field on `match()`'s return type
- `src/core/Application.ts` — extract a `runMiddleware()` helper, run route-specific middleware between matching and handler invocation
- `tests/unit/router.test.ts` — append group/name test coverage
- `src/index.ts` — export `RouteBuilder`, `GroupOptions`

New files:
- `tests/integration/router-middleware.test.ts` — real HTTP test proving middleware ordering and short-circuit behavior end-to-end

---

### Task 1: `Router` — groups, prefixes, per-route builder, named routes

**Files:**
- Modify: `src/core/routing/Router.ts` (full-file rewrite; current file is 85 lines)
- Modify: `tests/unit/router.test.ts` (append — do not change any existing test)

**Interfaces:**
- Produces: `GroupOptions { prefix?, middleware?, name? }`, `RouteBuilder` (`.middleware(...mw): this`, `.name(name): this`), `Router.group(options, callback)`, `Router.route(name, params?): string`. `Router.get/post/put/patch/delete/add` now return `RouteBuilder` instead of `void`. `Router.match()`'s return type gains `middleware: Middleware[]`. Used by Task 2 (`Application.serve()` reads `route.middleware` from `match()`'s result).

- [ ] **Step 1: Write the failing tests**

Add this import to the top of `tests/unit/router.test.ts`, alongside the existing `Router` import:

```ts
import { BaseMiddleware } from "../../src/core/middleware/Middleware";
```

Append these two describe blocks at the end of `tests/unit/router.test.ts` (after the existing closing `});` of the `"Router"` describe block — i.e. these become new top-level `describe` blocks in the file, siblings of `describe("Router", ...)`, not nested inside it):

```ts
describe("Route Groups", () => {
  test("applies a group prefix to nested routes", () => {
    const router = new Router();
    router.group({ prefix: "api" }, (router) => {
      router.get("/users", () => new Response("Users"));
    });

    expect(router.getRoutes()[0]?.path).toBe("/api/users");
    expect(router.match("GET", "/api/users")).not.toBeNull();
  });

  test("nests group prefixes outer to inner", () => {
    const router = new Router();
    router.group({ prefix: "api" }, (router) => {
      router.group({ prefix: "v1" }, (router) => {
        router.get("/posts", () => new Response("Posts"));
      });
    });

    expect(router.getRoutes()[0]?.path).toBe("/api/v1/posts");
  });

  test("normalizes slashes when joining prefixes", () => {
    const router = new Router();
    router.group({ prefix: "/api/" }, (router) => {
      router.get("users", () => new Response("Users"));
    });

    expect(router.getRoutes()[0]?.path).toBe("/api/users");
  });

  test("group with no prefix does not affect the path", () => {
    const router = new Router();
    class NoopMiddleware extends BaseMiddleware {
      async handle(request: Request): Promise<Request | Response> {
        return request;
      }
    }

    router.group({ middleware: [new NoopMiddleware()] }, (router) => {
      router.get("/users", () => new Response("Users"));
    });

    expect(router.getRoutes()[0]?.path).toBe("/users");
  });

  test("accumulates group middleware onto the matched route, outer to inner", () => {
    const router = new Router();
    class NoopMiddleware extends BaseMiddleware {
      async handle(request: Request): Promise<Request | Response> {
        return request;
      }
    }
    const outer = new NoopMiddleware();
    const inner = new NoopMiddleware();

    router.group({ middleware: [outer] }, (router) => {
      router.group({ middleware: [inner] }, (router) => {
        router.get("/users", () => new Response("Users"));
      });
    });

    const match = router.match("GET", "/users");
    expect(match?.middleware).toEqual([outer, inner]);
  });

  test("per-route middleware() appends after group middleware", () => {
    const router = new Router();
    class NoopMiddleware extends BaseMiddleware {
      async handle(request: Request): Promise<Request | Response> {
        return request;
      }
    }
    const groupMw = new NoopMiddleware();
    const routeMw = new NoopMiddleware();

    router.group({ middleware: [groupMw] }, (router) => {
      router.get("/users", () => new Response("Users")).middleware(routeMw);
    });

    const match = router.match("GET", "/users");
    expect(match?.middleware).toEqual([groupMw, routeMw]);
  });

  test("existing ungrouped routes have an empty middleware array", () => {
    const router = new Router();
    router.get("/users", () => new Response("Users"));

    const match = router.match("GET", "/users");
    expect(match?.middleware).toEqual([]);
  });
});

describe("Named Routes", () => {
  test("resolves a named route with no parameters", () => {
    const router = new Router();
    router.get("/users", () => new Response("Users")).name("users.index");

    expect(router.route("users.index")).toBe("/users");
  });

  test("resolves a named route substituting parameters", () => {
    const router = new Router();
    router.get("/users/{id}", () => new Response("User")).name("users.show");

    expect(router.route("users.show", { id: 42 })).toBe("/users/42");
  });

  test("concatenates group name prefix with the route's own name", () => {
    const router = new Router();
    router.group({ prefix: "api", name: "api." }, (router) => {
      router.get("/users", () => new Response("Users")).name("users.index");
    });

    expect(router.route("api.users.index")).toBe("/api/users");
  });

  test("throws for an unknown route name", () => {
    const router = new Router();
    expect(() => router.route("nonexistent")).toThrow("Route [nonexistent] not defined.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/router.test.ts`
Expected: FAIL — `router.group is not a function` (and similar for `.middleware()`, `.name()`, `router.route()`, and `match?.middleware` being `undefined`)

- [ ] **Step 3: Write minimal implementation**

Replace `src/core/routing/Router.ts` entirely with:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/router.test.ts`
Expected: `27 pass, 0 fail` (16 existing + 11 new: 7 in "Route Groups", 4 in "Named Routes")

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `bun test`
Expected: `410 pass, 0 fail` (399 existing + 11 new)

- [ ] **Step 6: Commit**

```bash
git add src/core/routing/Router.ts tests/unit/router.test.ts
git commit -m "feat(routing): add route groups, prefixes, and named routes"
```

---

### Task 2: Wire route-specific middleware into `Application.serve()`

**Files:**
- Modify: `src/core/Application.ts`
- Create: `tests/integration/router-middleware.test.ts`

**Interfaces:**
- Consumes: `Router.match()`'s `middleware: Middleware[]` field (Task 1), the existing `Middleware` interface (`handle(request): Promise<Request | Response>`), the existing `BaseMiddleware`, `UnauthorizedException`.
- Produces: route-specific middleware now runs (short-circuiting on a `Response`, same as global middleware) between route matching and handler invocation, for every request that matches a route.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/router-middleware.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Application } from "../../src/core/Application";
import { BaseMiddleware } from "../../src/core/middleware/Middleware";
import { UnauthorizedException } from "../../src/core/exceptions/HttpException";
import { TestClient } from "../helpers/test-helpers";

const PORT = 34782;

class CallLog {
  public calls: string[] = [];
}

class LoggingMiddleware extends BaseMiddleware {
  private log: CallLog;
  private label: string;

  constructor(log: CallLog, label: string) {
    super();
    this.log = log;
    this.label = label;
  }

  async handle(request: Request): Promise<Request | Response> {
    this.log.calls.push(this.label);
    return request;
  }
}

class RejectMiddleware extends BaseMiddleware {
  async handle(): Promise<Request | Response> {
    throw new UnauthorizedException("blocked");
  }
}

describe("Route group middleware integration", () => {
  let app: Application;
  let client: TestClient;
  let log: CallLog;

  beforeAll(async () => {
    log = new CallLog();
    app = new Application();
    app.use(new LoggingMiddleware(log, "global"));

    const router = app.getRouter();
    router.get("/public", () => new Response("public ok"));

    router.group({ prefix: "protected", middleware: [new RejectMiddleware()] }, (router) => {
      router.get("/resource", () => new Response("should not reach"));
    });

    router.group({ prefix: "logged", middleware: [new LoggingMiddleware(log, "group")] }, (router) => {
      router.get("/resource", () => new Response("logged ok")).middleware(new LoggingMiddleware(log, "route"));
    });

    await app.serve(PORT);
    client = new TestClient(`http://localhost:${PORT}`);
  });

  afterAll(async () => {
    await app.stop();
  });

  test("ungrouped route is unaffected by group middleware", async () => {
    const response = await client.get("/public");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("public ok");
  });

  test("group middleware blocks the request before the handler runs", async () => {
    const response = await client.get("/protected/resource");
    expect(response.status).toBe(401);
  });

  test("global middleware still runs for a 404", async () => {
    log.calls = [];
    const response = await client.get("/does-not-exist");
    expect(response.status).toBe(404);
    expect(log.calls).toEqual(["global"]);
  });

  test("group and per-route middleware run in order before the handler", async () => {
    log.calls = [];
    const response = await client.get("/logged/resource");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("logged ok");
    expect(log.calls).toEqual(["global", "group", "route"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/integration/router-middleware.test.ts`
Expected: FAIL — the "group middleware blocks the request" test gets a 200 instead of 401 (route-specific middleware isn't wired up yet, so `RejectMiddleware` never runs), and the "group and per-route middleware run in order" test's `log.calls` is `["global"]` instead of `["global", "group", "route"]`

- [ ] **Step 3: Write minimal implementation**

In `src/core/Application.ts`, replace the `serve` method:

```ts
  public async serve(port: number = 3000): Promise<void> {
    const router = this.router;
    const middleware = this.middleware;
    const exceptionHandler = this.exceptionHandler;

    async function runMiddleware(chain: Middleware[], request: Request): Promise<Request | Response> {
      let current = request;
      for (const mw of chain) {
        const result = await mw.handle(current);
        if (result instanceof Response) {
          return result;
        }
        current = result;
      }
      return current;
    }

    this.server = Bun.serve({
      port,
      async fetch(req: Request): Promise<Response> {
        try {
          const url = new URL(req.url);
          const method = req.method;

          // Execute global middleware chain
          const afterGlobal = await runMiddleware(middleware, req);
          if (afterGlobal instanceof Response) {
            return afterGlobal;
          }
          let request = afterGlobal;

          // Route the request
          const route = router.match(method, url.pathname);

          if (!route) {
            throw new NotFoundException(`Route not found: ${method} ${url.pathname}`);
          }

          // Execute route-specific (group + per-route) middleware chain
          const afterRoute = await runMiddleware(route.middleware, request);
          if (afterRoute instanceof Response) {
            return afterRoute;
          }
          request = afterRoute;

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
```

No other part of `Application.ts` changes — `runMiddleware` is a local closure function inside `serve()` (matching the existing pattern where `fetch` itself is a plain closure-capturing function, not a bound instance method, so it doesn't reference `this`).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/integration/router-middleware.test.ts`
Expected: `4 pass, 0 fail`

- [ ] **Step 5: Run the full suite**

Run: `bun test`
Expected: `414 pass, 0 fail` (410 after Task 1 + 4 new)

- [ ] **Step 6: Commit**

```bash
git add src/core/Application.ts tests/integration/router-middleware.test.ts
git commit -m "feat(routing): run route-specific middleware after matching"
```

---

### Task 3: Barrel exports

**Files:**
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `RouteBuilder`, `GroupOptions` (Task 1).
- Produces: public package exports — last task, no downstream consumers within this plan.

- [ ] **Step 1: Write the failing test**

There is no dedicated barrel-export test file for routing yet. Add this describe block to `tests/unit/router.test.ts`, at the very end of the file:

```ts
describe("src/index.ts barrel exports", () => {
  test("exports RouteBuilder and GroupOptions", async () => {
    const barrel = await import("../../src/index");
    expect(typeof barrel.RouteBuilder).toBe("function");

    // GroupOptions is a type-only export — verify it's usable as a type by
    // constructing a router and calling group() with an object shaped like it
    const router = new barrel.Router();
    router.group({ prefix: "api" }, (r: InstanceType<typeof barrel.Router>) => {
      r.get("/ok", () => new Response("ok"));
    });
    expect(router.getRoutes()[0]?.path).toBe("/api/ok");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/router.test.ts`
Expected: FAIL — `barrel.RouteBuilder` is `undefined`, `expect(typeof barrel.RouteBuilder).toBe("function")` fails

- [ ] **Step 3: Write minimal implementation**

In `src/index.ts`, find this existing line:

```ts
export { Router } from "./core/routing/Router";
```

Replace it, and the existing type-export line below it, with:

```ts
export { Router, RouteBuilder } from "./core/routing/Router";
export type { RouteHandler, Route, GroupOptions } from "./core/routing/Router";
```

(This replaces the current two lines — `export { Router } from "./core/routing/Router";` and `export type { RouteHandler, Route } from "./core/routing/Router";` — with the two lines above.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/unit/router.test.ts`
Expected: `28 pass, 0 fail` (27 from Task 1 + 1 new)

- [ ] **Step 5: Run the full suite**

Run: `bun test`
Expected: `415 pass, 0 fail` (414 after Task 2 + 1 new)

- [ ] **Step 6: Commit**

```bash
git add src/index.ts tests/unit/router.test.ts
git commit -m "feat(routing): export RouteBuilder and GroupOptions from src/index.ts"
```

---

## Self-Review Notes

- **Spec coverage:** `GroupOptions`/`group()`/nesting (Task 1), `RouteBuilder`/per-route `.middleware()`/`.name()` (Task 1), named-route resolution `route()` (Task 1), execution-model change in `Application.serve()` (Task 2), barrel exports (Task 3) — every component in the spec has a task.
- **Non-goals respected:** no route caching, no `Route::resource()`, no route-model binding, no domain routing added anywhere in this plan.
- **Backward compatibility verified by construction:** `joinPaths(path)` with an empty `groupStack` reproduces the original path unchanged for every existing route pattern in `routes/web.ts` (`/`, `/hello/{name}`, `/data`, `/auth/register`, etc. — all single leading slash, no trailing slash) — traced by hand: `"/foo".replace(/^\/+|\/+$/g, "")` strips only the leading slash, leaving `"foo"`, which `joinPaths` re-prefixes with `/`, reproducing the input exactly. Root path `"/"` strips to `""`, filtered out of the segments array, `joinPaths` returns `"/"` — matches the existing root-path test.
- **Type consistency checked:** `Router.match()`'s return type, `RouteBuilder`'s constructor, and `Application.serve()`'s use of `route.middleware` all agree on `Middleware[]`. `Router.group()`'s callback parameter type (`(router: Router) => void`) matches how every task's example code calls it (`(router) => { router.get(...) }`).
