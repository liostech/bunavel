
import { Seeder } from "../../../src/core/database/Seeder";

export default class ErrorSeeder extends Seeder {
  async run(db) {
    throw new Error("Seeder error");
  }
}
