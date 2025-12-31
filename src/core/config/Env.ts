import { existsSync } from "fs";
import { join } from "path";

export class Env {
  private static loaded: boolean = false;
  private static values: Record<string, string> = {};

  /**
   * Load environment variables from .env file
   */
  public static load(path?: string): void {
    if (this.loaded) {
      return;
    }

    const envPath = path || join(process.cwd(), ".env");

    if (existsSync(envPath)) {
      const file = Bun.file(envPath);
      const content = file.text();
      
      content.then((text) => {
        this.parse(text);
        this.loaded = true;
      });
    } else {
      // Load from process.env
      this.values = { ...process.env } as Record<string, string>;
      this.loaded = true;
    }
  }

  /**
   * Parse .env file content
   */
  private static parse(content: string): void {
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Parse key=value
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1]?.trim();
        let value = match[2]?.trim();

        if (key && value !== undefined) {
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          this.values[key] = value;
          process.env[key] = value;
        }
      }
    }
  }

  /**
   * Get an environment variable
   */
  public static get(key: string, defaultValue?: string): string | undefined {
    if (!this.loaded) {
      this.load();
    }

    return this.values[key] ?? process.env[key] ?? defaultValue;
  }

  /**
   * Get an environment variable as string (throw if not found)
   */
  public static getOrFail(key: string): string {
    const value = this.get(key);
    if (value === undefined) {
      throw new Error(`Environment variable ${key} is not defined`);
    }
    return value;
  }

  /**
   * Get an environment variable as number
   */
  public static getNumber(key: string, defaultValue?: number): number | undefined {
    const value = this.get(key);
    if (value === undefined) {
      return defaultValue;
    }
    const parsed = Number(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Get an environment variable as boolean
   */
  public static getBoolean(key: string, defaultValue?: boolean): boolean | undefined {
    const value = this.get(key);
    if (value === undefined) {
      return defaultValue;
    }
    return value.toLowerCase() === "true" || value === "1";
  }

  /**
   * Check if an environment variable exists
   */
  public static has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Get all environment variables
   */
  public static all(): Record<string, string> {
    if (!this.loaded) {
      this.load();
    }
    return { ...this.values };
  }

  /**
   * Set an environment variable (runtime only)
   */
  public static set(key: string, value: string): void {
    this.values[key] = value;
    process.env[key] = value;
  }
}

// Auto-load on import
Env.load();
