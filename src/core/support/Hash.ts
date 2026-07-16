/**
 * Password hashing facade over Bun's built-in bcrypt implementation
 */
export class Hash {
  /**
   * Hash a plaintext value
   */
  public static async make(value: string): Promise<string> {
    return Bun.password.hash(value);
  }

  /**
   * Verify a plaintext value against a hash
   */
  public static async check(value: string, hash: string): Promise<boolean> {
    return Bun.password.verify(value, hash);
  }
}
