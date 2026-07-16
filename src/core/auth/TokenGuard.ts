import type { Cache } from "../cache/Cache";
import type { Guard } from "./Guard";
import type { UserProvider } from "./UserProvider";

/**
 * Sanctum-style opaque bearer token guard, backed by the Cache system
 */
export class TokenGuard implements Guard {
  private provider: UserProvider;
  private cache: Cache;

  constructor(provider: UserProvider, cache: Cache) {
    this.provider = provider;
    this.cache = cache;
  }

  private cacheKey(token: string): string {
    return `auth_token:${token}`;
  }

  private tokenFromRequest(request: Request): string | null {
    const header = request.headers.get("authorization");
    if (!header || !header.startsWith("Bearer ")) {
      return null;
    }
    return header.slice("Bearer ".length).trim() || null;
  }

  public async attempt(credentials: Record<string, any>): Promise<string | null> {
    const user = this.provider.retrieveByCredentials(credentials);
    if (!user) {
      return null;
    }

    const valid = await this.provider.validateCredentials(user, credentials);
    if (!valid) {
      return null;
    }

    return this.login(user);
  }

  public login(user: any): string {
    const token = crypto.randomUUID();
    this.cache.forever(this.cacheKey(token), user.get("id"));
    return token;
  }

  public user(request: Request): any | null {
    const token = this.tokenFromRequest(request);
    if (!token) {
      return null;
    }

    const userId = this.cache.get<string | number>(this.cacheKey(token));
    if (userId === null) {
      return null;
    }

    return this.provider.retrieveById(userId);
  }

  public check(request: Request): boolean {
    return this.user(request) !== null;
  }

  public guest(request: Request): boolean {
    return !this.check(request);
  }

  public id(request: Request): string | number | null {
    const user = this.user(request);
    return user ? user.get("id") : null;
  }

  public logout(request: Request): void {
    const token = this.tokenFromRequest(request);
    if (token) {
      this.cache.forget(this.cacheKey(token));
    }
  }
}
