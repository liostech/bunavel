import { Model } from "../../src/core/database/Model";

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
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(password);
    this.set("password", hasher.digest("hex"));
  }

  /**
   * Verify password
   */
  public async verifyPassword(password: string): Promise<boolean> {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(password);
    const hashed = hasher.digest("hex");
    return hashed === this.get("password");
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
