import { describe, test, expect } from "bun:test";
import { Router } from "../../src/core/routing/Router";
import { BaseMiddleware } from "../../src/core/middleware/Middleware";

describe("Router", () => {
  describe("Basic Routing", () => {
    test("should register GET route", () => {
      const router = new Router();
      const handler = () => new Response("Hello");

      router.get("/test", handler);
      const routes = router.getRoutes();

      expect(routes.length).toBe(1);
      expect(routes[0]?.method).toBe("GET");
      expect(routes[0]?.path).toBe("/test");
    });

    test("should register POST route", () => {
      const router = new Router();
      const handler = () => new Response("Created");

      router.post("/users", handler);
      const routes = router.getRoutes();

      expect(routes.length).toBe(1);
      expect(routes[0]?.method).toBe("POST");
    });

    test("should register multiple HTTP methods", () => {
      const router = new Router();
      const handler = () => new Response("OK");

      router.get("/test", handler);
      router.post("/test", handler);
      router.put("/test", handler);
      router.patch("/test", handler);
      router.delete("/test", handler);

      expect(router.getRoutes().length).toBe(5);
    });
  });

  describe("Route Matching", () => {
    test("should match exact route", () => {
      const router = new Router();
      router.get("/users", () => new Response("Users"));

      const match = router.match("GET", "/users");

      expect(match).not.toBeNull();
      expect(match?.params).toEqual({});
    });

    test("should not match different path", () => {
      const router = new Router();
      router.get("/users", () => new Response("Users"));

      const match = router.match("GET", "/posts");

      expect(match).toBeNull();
    });

    test("should not match different method", () => {
      const router = new Router();
      router.get("/users", () => new Response("Users"));

      const match = router.match("POST", "/users");

      expect(match).toBeNull();
    });
  });

  describe("Route Parameters", () => {
    test("should extract single parameter", () => {
      const router = new Router();
      router.get("/users/{id}", () => new Response("User"));

      const match = router.match("GET", "/users/123");

      expect(match).not.toBeNull();
      expect(match?.params).toEqual({ id: "123" });
    });

    test("should extract multiple parameters", () => {
      const router = new Router();
      router.get("/users/{userId}/posts/{postId}", () => new Response("Post"));

      const match = router.match("GET", "/users/123/posts/456");

      expect(match).not.toBeNull();
      expect(match?.params).toEqual({ userId: "123", postId: "456" });
    });

    test("should extract parameter with special characters", () => {
      const router = new Router();
      router.get("/users/{id}", () => new Response("User"));

      const match = router.match("GET", "/users/abc-123");

      expect(match).not.toBeNull();
      expect(match?.params).toEqual({ id: "abc-123" });
    });

    test("should not match if segments don't align", () => {
      const router = new Router();
      router.get("/users/{id}/posts", () => new Response("Posts"));

      const match = router.match("GET", "/users/123");

      expect(match).toBeNull();
    });
  });

  describe("Route Handler Execution", () => {
    test("should call handler with correct parameters", async () => {
      const router = new Router();
      let capturedParams: Record<string, string> = {};

      router.get("/users/{id}", (req, params) => {
        capturedParams = params;
        return new Response("OK");
      });

      const match = router.match("GET", "/users/123");
      if (match) {
        const request = new Request("http://localhost/users/123");
        await match.handler(request, match.params);
      }

      expect(capturedParams).toEqual({ id: "123" });
    });
  });

  describe("Edge Cases", () => {
    test("should handle root path", () => {
      const router = new Router();
      router.get("/", () => new Response("Home"));

      const match = router.match("GET", "/");

      expect(match).not.toBeNull();
    });

    test("should handle trailing slashes", () => {
      const router = new Router();
      router.get("/users", () => new Response("Users"));

      // This should NOT match with trailing slash (exact match)
      const match = router.match("GET", "/users/");

      expect(match).toBeNull();
    });

    test("should handle case-sensitive paths", () => {
      const router = new Router();
      router.get("/users", () => new Response("Users"));

      const match = router.match("GET", "/Users");

      expect(match).toBeNull();
    });
  });
});

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

  test("restores the group stack even if the callback throws", () => {
    const router = new Router();

    expect(() => {
      router.group({ prefix: "broken" }, () => {
        throw new Error("boom");
      });
    }).toThrow("boom");

    // If the stack wasn't restored, this route would incorrectly get an
    // "/broken" prefix inherited from the failed group above.
    router.get("/users", () => new Response("Users"));
    expect(router.getRoutes()[router.getRoutes().length - 1]?.path).toBe("/users");
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
