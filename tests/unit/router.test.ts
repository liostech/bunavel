import { describe, test, expect } from "bun:test";
import { Router } from "../../src/core/routing/Router";

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
