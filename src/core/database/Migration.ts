/**
 * Base Migration class
 */
export abstract class Migration {
  /**
   * Run the migration
   */
  abstract up(): Promise<void>;

  /**
   * Reverse the migration
   */
  abstract down(): Promise<void>;
}
