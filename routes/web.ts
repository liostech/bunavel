import type { Router } from "../src/core/routing/Router";
import { WelcomeController } from "../app/controllers/WelcomeController";
import { AuthController } from "../app/controllers/AuthController";

export function registerRoutes(router: Router): void {
  const welcomeController = new WelcomeController();
  const authController = new AuthController();

  // Welcome routes
  router.get("/", (req) => welcomeController.index(req));
  router.get("/hello/{name}", (req, params) => welcomeController.show(req, params));
  router.post("/data", (req) => welcomeController.store(req));

  // Auth routes
  router.post("/auth/register", (req) => authController.register(req));
  router.post("/auth/login", (req) => authController.login(req));
  router.get("/auth/me", (req) => authController.me(req));
  router.post("/auth/logout", (req) => authController.logout(req));
  router.get("/users/{id}", (req, params) => authController.profile(req, params));

  // API routes
  router.get("/api/status", () => {
    return new Response(
      JSON.stringify({
        status: "ok",
        timestamp: new Date().toISOString(),
        framework: "Bunavel",
        version: "0.1.0",
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  });
}
