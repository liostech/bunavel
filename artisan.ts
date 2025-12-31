#!/usr/bin/env bun

import { Artisan } from "./src/core/cli/Artisan";
import { MakeControllerCommand } from "./src/core/cli/commands/MakeControllerCommand";
import { MakeModelCommand } from "./src/core/cli/commands/MakeModelCommand";
import { MakeMiddlewareCommand } from "./src/core/cli/commands/MakeMiddlewareCommand";
import { MakeMigrationCommand } from "./src/core/cli/commands/MakeMigrationCommand";
import { RoutesListCommand } from "./src/core/cli/commands/RoutesListCommand";
import { ServeCommand } from "./src/core/cli/commands/ServeCommand";
import { MigrateCommand } from "./src/core/cli/commands/MigrateCommand";
import { MigrateRollbackCommand } from "./src/core/cli/commands/MigrateRollbackCommand";
import { MigrateFreshCommand } from "./src/core/cli/commands/MigrateFreshCommand";
import { MigrateStatusCommand } from "./src/core/cli/commands/MigrateStatusCommand";

/**
 * Bunavel Artisan CLI
 */
async function main() {
  const artisan = new Artisan();

  // Register make commands
  artisan.register(new MakeControllerCommand());
  artisan.register(new MakeModelCommand());
  artisan.register(new MakeMiddlewareCommand());
  artisan.register(new MakeMigrationCommand());
  
  // Register migration commands
  artisan.register(new MigrateCommand());
  artisan.register(new MigrateRollbackCommand());
  artisan.register(new MigrateFreshCommand());
  artisan.register(new MigrateStatusCommand());
  
  // Register other commands
  artisan.register(new RoutesListCommand());
  artisan.register(new ServeCommand());

  // Run CLI with arguments (skip first two: bun and script path)
  await artisan.run(process.argv.slice(2));
}

main();
