/**
 * Resolves user records for the auth system. Decouples Guard implementations
 * from any specific Model.
 */
export interface UserProvider<TUser = any> {
  /**
   * Retrieve a user by their unique identifier
   */
  retrieveById(id: string | number): TUser | null;

  /**
   * Retrieve a user matching the given credentials (e.g. { email: "..." })
   */
  retrieveByCredentials(credentials: Record<string, any>): TUser | null;

  /**
   * Validate a user's credentials (e.g. check password)
   */
  validateCredentials(user: TUser, credentials: Record<string, any>): Promise<boolean>;
}
