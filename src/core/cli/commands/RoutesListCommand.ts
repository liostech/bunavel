import { Command } from "../Command";

/**
 * Routes List command
 */
export class RoutesListCommand extends Command {
  name = "routes:list";
  description = "List all registered routes";
  signature = "routes:list";

  async handle(args: string[], options: Record<string, any>): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { Application } = await import("../../Application");
      
      // Create a temporary app instance to get routes
      const app = new Application();
      
      // Import and register routes
      const routesPath = `${process.cwd()}/routes/web.ts`;
      try {
        await import(routesPath);
      } catch (error) {
        this.warn("No routes file found at routes/web.ts");
      }

      const router = app.getRouter();
      const routes = router.getRoutes();

      if (routes.length === 0) {
        this.info("No routes registered");
        return;
      }

      // Display routes table
      console.log("\n\x1b[33m╔════════════════════════════════════════════════════════════════════╗");
      console.log("║                         Routes List                                 ║");
      console.log("╚════════════════════════════════════════════════════════════════════╝\x1b[0m\n");

      // Table header
      const methodWidth = 10;
      const pathWidth = 50;

      console.log(
        `\x1b[32m${this.pad("Method", methodWidth)} ${this.pad("Path", pathWidth)}\x1b[0m`
      );
      console.log("─".repeat(methodWidth + pathWidth + 2));

      // Table rows
      for (const route of routes) {
        const method = route.method.toUpperCase();
        const path = route.path;

        console.log(
          `${this.pad(method, methodWidth)} ${this.pad(path, pathWidth)}`
        );
      }

      console.log("\n\x1b[32mTotal routes:\x1b[0m", routes.length, "\n");
    } catch (error) {
      this.error(`Failed to list routes: ${(error as Error).message}`);
    }
  }

  /**
   * Pad string to specified width
   */
  private pad(str: string, width: number): string {
    if (str.length >= width) {
      return str.substring(0, width - 3) + "...";
    }
    return str + " ".repeat(width - str.length);
  }
}
