import type { Guard } from "./Guard";

/**
 * Static auth facade, mirroring the Env facade convention. Requires
 * Auth.setGuard() to be called once at application bootstrap.
 */
export class Auth {
  private static guard: Guard | null = null;

  public static setGuard(guard: Guard): void {
    this.guard = guard;
  }

  private static getGuard(): Guard {
    if (!this.guard) {
      throw new Error("Auth guard has not been configured. Call Auth.setGuard() first.");
    }
    return this.guard;
  }

  public static attempt(credentials: Record<string, any>): Promise<string | null> {
    return this.getGuard().attempt(credentials);
  }

  public static login(user: any): string {
    return this.getGuard().login(user);
  }

  public static user(request: Request): any | null {
    return this.getGuard().user(request);
  }

  public static check(request: Request): boolean {
    return this.getGuard().check(request);
  }

  public static guest(request: Request): boolean {
    return this.getGuard().guest(request);
  }

  public static id(request: Request): string | number | null {
    return this.getGuard().id(request);
  }

  public static logout(request: Request): void {
    this.getGuard().logout(request);
  }
}
