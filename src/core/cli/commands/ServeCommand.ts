import { Command } from "../Command";

/**
 * Serve command - Start the development server
 */
export class ServeCommand extends Command {
  name = "serve";
  description = "Start the development server";
  signature = "serve {--port=3000} {--host=localhost}";

  async handle(args: string[], options: Record<string, any>): Promise<void> {
    const port = options.port || 3000;
    const host = options.host || "localhost";

    try {
      this.info(`Starting Bunavel development server...`);
      this.info(`Server will be available at: http://${host}:${port}`);
      this.info(`Press Ctrl+C to stop the server\n`);

      // Dynamic import the main application
      const indexPath = `${process.cwd()}/index.ts`;
      
      // Use Bun's process spawn to run the server
      const proc = Bun.spawn(["bun", "run", indexPath], {
        env: {
          ...process.env,
          PORT: port.toString(),
          HOST: host.toString(),
        },
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit",
      });

      // Handle Ctrl+C gracefully
      process.on("SIGINT", () => {
        this.info("\n\nShutting down server...");
        proc.kill();
        process.exit(0);
      });

      // Wait for the process to complete
      await proc.exited;
      
    } catch (error) {
      this.error(`Failed to start server: ${(error as Error).message}`);
      process.exit(1);
    }
  }
}
