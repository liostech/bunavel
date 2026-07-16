/**
 * Contract for an authentication guard
 */
export interface Guard {
  /**
   * Attempt to authenticate with the given credentials. Returns a token on
   * success, null on failure.
   */
  attempt(credentials: Record<string, any>): Promise<string | null>;

  /**
   * Issue a token for a known user without checking credentials
   */
  login(user: any): string;

  /**
   * Resolve the currently authenticated user for a request, or null
   */
  user(request: Request): any | null;

  /**
   * Whether the request is authenticated
   */
  check(request: Request): boolean;

  /**
   * Whether the request is unauthenticated
   */
  guest(request: Request): boolean;

  /**
   * The authenticated user's identifier, or null
   */
  id(request: Request): string | number | null;

  /**
   * Revoke the request's token
   */
  logout(request: Request): void;
}
