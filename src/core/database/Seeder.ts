import type { DatabaseConnection } from "./Connection";

/**
 * Base Seeder class
 * All seeders should extend this class and implement the run() method
 */
export abstract class Seeder {
  /**
   * Run the database seeds
   */
  abstract run(db: DatabaseConnection): Promise<void>;

  /**
   * Call other seeders
   */
  protected async call(
    db: DatabaseConnection,
    seeders: Array<new () => Seeder>
  ): Promise<void> {
    for (const SeederClass of seeders) {
      const seeder = new SeederClass();
      await seeder.run(db);
    }
  }
}
