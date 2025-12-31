import { Command } from "./Command";

/**
 * Artisan CLI application
 */
export class Artisan {
  private commands: Map<string, Command> = new Map();

  /**
   * Register a command
   */
  register(command: Command): void {
    this.commands.set(command.name, command);
  }

  /**
   * Get all registered commands
   */
  getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Run the CLI with provided arguments
   */
  async run(args: string[]): Promise<void> {
    // Remove "bun" and script path from args
    const [commandName, ...commandArgs] = args;

    if (!commandName || commandName === "help" || commandName === "-h" || commandName === "--help") {
      this.showHelp();
      return;
    }

    if (commandName === "list") {
      this.listCommands();
      return;
    }

    const command = this.commands.get(commandName);

    if (!command) {
      console.error(`\x1b[31mCommand "${commandName}" not found.\x1b[0m\n`);
      this.showHelp();
      process.exit(1);
    }

    try {
      const { args: parsedArgs, options } = command["parseArgs"](command.signature, commandArgs);
      await command.handle(parsedArgs, options);
    } catch (error) {
      console.error(`\x1b[31mError:\x1b[0m ${(error as Error).message}`);
      process.exit(1);
    }
  }

  /**
   * Show help message
   */
  private showHelp(): void {
    console.log(`
\x1b[33m╔════════════════════════════════════════════════════╗
║              Bunavel Artisan CLI                   ║
╚════════════════════════════════════════════════════╝\x1b[0m

\x1b[32mUsage:\x1b[0m
  bun artisan <command> [arguments] [options]

\x1b[32mAvailable Commands:\x1b[0m`);

    // Group commands by category
    const grouped = new Map<string, Command[]>();
    
    for (const command of this.commands.values()) {
      const category = command.name.includes(":") ? command.name.split(":")[0]! : "General";
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(command);
    }

    for (const [category, commands] of grouped) {
      console.log(`\n\x1b[33m${category}\x1b[0m`);
      for (const cmd of commands) {
        const padding = " ".repeat(Math.max(0, 25 - cmd.name.length));
        console.log(`  \x1b[32m${cmd.name}\x1b[0m${padding}${cmd.description}`);
      }
    }

    console.log(`\n\x1b[32mOptions:\x1b[0m
  -h, --help    Display help for command
  list          List all available commands
`);
  }

  /**
   * List all commands
   */
  private listCommands(): void {
    console.log("\x1b[32mAvailable commands:\x1b[0m\n");
    
    for (const command of this.commands.values()) {
      console.log(`  ${command.name}`);
    }
    
    console.log();
  }
}
