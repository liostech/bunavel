/**
 * Base Command class for Artisan CLI
 */
export abstract class Command {
  /**
   * Command name (e.g., "make:controller")
   */
  abstract name: string;

  /**
   * Command description
   */
  abstract description: string;

  /**
   * Command signature with arguments/options
   * Example: "make:controller {name} {--resource}"
   */
  abstract signature: string;

  /**
   * Execute the command
   */
  abstract handle(args: string[], options: Record<string, any>): Promise<void> | void;

  /**
   * Parse command signature and validate arguments
   */
  protected parseArgs(signature: string, args: string[]): { args: string[]; options: Record<string, any> } {
    const parsedOptions: Record<string, any> = {};
    const parsedArgs: string[] = [];

    // Extract expected arguments from signature
    const signatureParts = signature.match(/\{[^}]+\}/g) || [];
    const requiredArgs = signatureParts.filter(p => !p.includes("--") && !p.includes("?")).length;

    // Parse provided arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]!;
      
      if (arg.startsWith("--")) {
        // Handle --option=value or --flag
        const [key, value] = arg.slice(2).split("=");
        parsedOptions[key!] = value || true;
      } else if (arg.startsWith("-")) {
        // Handle -f flag
        parsedOptions[arg.slice(1)] = true;
      } else {
        parsedArgs.push(arg);
      }
    }

    // Validate required arguments
    if (parsedArgs.length < requiredArgs) {
      throw new Error(`Missing required arguments. Expected ${requiredArgs}, got ${parsedArgs.length}`);
    }

    return { args: parsedArgs, options: parsedOptions };
  }

  /**
   * Display success message
   */
  protected success(message: string): void {
    console.log(`\x1b[32m✓\x1b[0m ${message}`);
  }

  /**
   * Display error message
   */
  protected error(message: string): void {
    console.error(`\x1b[31m✗\x1b[0m ${message}`);
  }

  /**
   * Display info message
   */
  protected info(message: string): void {
    console.log(`\x1b[34mℹ\x1b[0m ${message}`);
  }

  /**
   * Display warning message
   */
  protected warn(message: string): void {
    console.warn(`\x1b[33m⚠\x1b[0m ${message}`);
  }
}
