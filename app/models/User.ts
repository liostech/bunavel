import { Model } from "../../src/core/database/Model";
import { Hash } from "../../src/core/support/Hash";

export class User extends Model {
  protected static override tableName = "users";

  // Attributes
  public id?: number;
  public name?: string;
  public email?: string;
  public password?: string;
  public created_at?: string;
  public updated_at?: string;

  /**
   * Hash password before saving
   */
  public async setPassword(password: string): Promise<void> {
    this.set("password", await Hash.make(password));
  }

  /**
   * Verify password
   */
  public async verifyPassword(password: string): Promise<boolean> {
    const hashed = this.get("password");
    return hashed ? Hash.check(password, hashed) : false;
  }

  /**
   * Find user by email
   */
  public static findByEmail(email: string): User | null {
    const result = this.query().where("email", "=", email).first();
    return result ? this.hydrate<User>(result) : null;
  }

  /**
   * Convert to JSON (hide password)
   */
  public override toJson(): Record<string, any> {
    const data = super.toJson();
    delete data.password;
    return data;
  }
}
