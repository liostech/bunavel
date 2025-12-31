#!/usr/bin/env bun

import { Artisan } from "./src/core/cli/Artisan";
import { MakeControllerCommand } from "./src/core/cli/commands/MakeControllerCommand";
import { MakeModelCommand } from "./src/core/cli/commands/MakeModelCommand";
import { MakeMiddlewareCommand } from "./src/core/cli/commands/MakeMiddlewareCommand";
import { RoutesListCommand } from "./src/core/cli/commands/RoutesListCommand";
import { ServeCommand } from "./src/core/cli/commands/ServeCommand";

/**
 * Bunavel Artisan CLI
 */
async function main() {
  const artisan = new Artisan();

  // Register all commands
  artisan.register(new MakeControllerCommand());
  artisan.register(new MakeModelCommand());
  artisan.register(new MakeMiddlewareCommand());
  artisan.register(new RoutesListCommand());
  artisan.register(new ServeCommand());

  // Run CLI with arguments (skip first two: bun and script path)
  await artisan.run(process.argv.slice(2));
}

main();
