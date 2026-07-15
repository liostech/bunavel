# Auth Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Laravel-style authentication system to Bunavel — a static `Auth` facade backed by an opaque-token `Guard`, a `Hash` facade replacing unsalted SHA-256 passwords, and a working register/login/me/logout flow wired into the example app.

**Architecture:** `Auth` (static facade, mirrors the existing `Env` class) delegates to a single configured `Guard`. `TokenGuard` is the only `Guard` implementation: it mints opaque `crypto.randomUUID()` tokens and stores `token -> userId` in the framework's existing `Cache` system. A `UserProvider` interface decouples the guard from any specific model; `EloquentUserProvider` is the default, working against any `Model` subclass.

**Tech Stack:** Bun, TypeScript, `bun:test`, `bun:sqlite` (via the existing `DatabaseConnection`), `Bun.password` (bcrypt), the existing `Cache`/`Model`/`Schema`/`Router`/`Application` classes.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-15-auth-guards-design.md` — read it if anything below is ambiguous.
- Run the full suite with `bun test` (currently 369 pass / 0 fail — must stay green after every task).
- `verbatimModuleSyntax` is enabled in `tsconfig.json` — any import used only as a type MUST use `import type { X }` (a plain `import { X }` on a type-only symbol is a build error).
- `noImplicitOverride` is enabled — but implementing an **abstract** base member (e.g. `BaseMiddleware.handle`) does NOT require the `override` keyword; only overriding a **concrete** member does (see `RateLimitMiddleware.handle` for the existing precedent of no `override`, and `User.toJson` for the existing precedent of `override` on a concrete override).
- Follow the existing static-facade convention used by `src/core/config/Env.ts` for `Auth`.
- No new npm dependencies — `Bun.password` (bcrypt) and `crypto.randomUUID()` are both Bun/Web-platform globals, no import needed.
- Test files in this repo import directly from source paths (e.g. `"../../src/core/exceptions/HttpException"`), not from the `src/index.ts` barrel — keep following that pattern except in the one barrel smoke-test in Task 7.

---

## File Structure

New files:
- `src/core/support/Hash.ts` — `Hash.make()` / `Hash.check()` over `Bun.password`
- `src/core/auth/UserProvider.ts` — `UserProvider<TUser>` interface
- `src/core/auth/EloquentUserProvider.ts` — default `UserProvider` backed by a `Model` subclass
- `src/core/auth/Guard.ts` — `Guard` interface
- `src/core/auth/TokenGuard.ts` — `Guard` implementation backed by `Cache`
- `src/core/auth/Auth.ts` — static facade
- `src/core/auth/AuthMiddleware.ts` — optional global middleware, 401s guests
- `database/migrations/20260715000000_create_users_table.ts` — first real migration in the repo (none exist today)
- `tests/unit/auth.test.ts` — unit tests, built up incrementally across Tasks 1–5 and 7
- `tests/integration/auth.test.ts` — HTTP round-trip test (Task 6)

Modified files:
- `src/core/database/Model.ts` — widen `hydrate` from `protected static` to `public static`
- `app/models/User.ts` — use `Hash` instead of raw SHA-256
- `app/controllers/AuthController.ts` — use `Auth` instead of the dead-end hand-rolled token
- `routes/web.ts` — add `GET /auth/me`, `POST /auth/logout`
- `index.ts` — wire up a real database connection (there is none today) and call `Auth.setGuard(...)`
- `src/index.ts` — export the new auth module

---

### Task 1: `Hash` facade

**Files:**
- Create: `src/core/support/Hash.ts`
- Create: `tests/unit/auth.test.ts`

**Interfaces:**
- Produces: `Hash.make(value: string): Promise<string>`, `Hash.check(value: string, hash: string): Promise<boolean>` — used by `EloquentUserProvider` (Task 2) and `app/models/User.ts` (Task 6).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/auth.test.ts`:

```ts
import { describe, test, expect } from "bun:test";
import { Hash } from "../../src/core/support/Hash";

describe("Hash", () => {
  test("make() returns a hash different from the plaintext", async () => {
    const hashed = await Hash.make("secret123");
    expect(typeof hashed).toBe("string");
    expect(hashed).not.toBe("secret123");
  });

  test("check() returns true for the correct plaintext", async () => {
    const hashed = await Hash.make("secret123");
    expect(await Hash.check("secret123", hashed)).toBe(true);
  });

  test("check() returns false for the wrong plaintext", async () => {
    const hashed = await Hash.make("secret123");
    expect(await Hash.check("wrong-password", hashed)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/auth.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/support/Hash'`

- [ ] **Step 3: Write minimal implementation**

Create `src/core/support/Hash.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/unit/auth.test.ts`
Expected: `3 pass, 0 fail`

- [ ] **Step 5: Commit**

```bash
git add src/core/support/Hash.ts tests/unit/auth.test.ts
git commit -m "feat(auth): add Hash facade over Bun.password"
```

---

### Task 2: `UserProvider` interface + `EloquentUserProvider`

**Files:**
- Modify: `src/core/database/Model.ts:137` (widen `hydrate` visibility)
- Create: `src/core/auth/UserProvider.ts`
- Create: `src/core/auth/EloquentUserProvider.ts`
- Modify: `tests/unit/auth.test.ts` (append)

**Interfaces:**
- Consumes: `Hash.make(value): Promise<string>` (Task 1), `Model.find<T>(id): T | null`, `Model.where(column, operator, value): QueryBuilder`, `QueryBuilder.first(): any`, `Model.hydrate<T>(data): T` (now public), `Model.get(key): any` (all pre-existing on `src/core/database/Model.ts`).
- Produces: `UserProvider<TUser>` interface with `retrieveById(id)`, `retrieveByCredentials(credentials)`, `validateCredentials(user, credentials): Promise<boolean>`. `EloquentUserProvider<TUser>` class implementing it, constructed as `new EloquentUserProvider(ModelClass, { usernameField?, passwordField? })`. Used by `TokenGuard` (Task 3) and the app bootstrap (Task 6).

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/auth.test.ts` (add these imports to the top of the file, alongside the existing `Hash` import):

```ts
import { Model } from "../../src/core/database/Model";
import { Schema } from "../../src/core/database/Schema";
import { DatabaseConnection } from "../../src/core/database/Connection";
import { EloquentUserProvider } from "../../src/core/auth/EloquentUserProvider";
```

Add a shared fixture model below the imports (top level of the file, after the `Hash` describe block):

```ts
class AuthTestUser extends Model {
  static override tableName = "auth_test_users";
}
```

Append this describe block at the end of the file:

```ts
describe("EloquentUserProvider", () => {
  let connection: DatabaseConnection;
  let provider: EloquentUserProvider<AuthTestUser>;
  let seededUserId: number;

  beforeAll(async () => {
    connection = new DatabaseConnection({ driver: "sqlite", connection: { filename: ":memory:" } });
    connection.connect();
    Model.setConnection(connection);
    Schema.setConnection(connection);

    await Schema.create("auth_test_users", (table) => {
      table.id();
      table.string("email");
      table.string("password");
    });

    const user = new AuthTestUser();
    user.fill({ email: "jane@example.com", password: await Hash.make("correct-password") });
    user.save();
    seededUserId = user.get("id");

    provider = new EloquentUserProvider(AuthTestUser);
  });

  afterAll(() => {
    connection.close();
  });

  test("retrieveById() returns the matching user", () => {
    const user = provider.retrieveById(seededUserId);
    expect(user).not.toBeNull();
    expect(user!.get("email")).toBe("jane@example.com");
  });

  test("retrieveById() returns null for an unknown id", () => {
    expect(provider.retrieveById(999999)).toBeNull();
  });

  test("retrieveByCredentials() returns the matching user by email", () => {
    const user = provider.retrieveByCredentials({ email: "jane@example.com" });
    expect(user).not.toBeNull();
    expect(user!.get("id")).toBe(seededUserId);
  });

  test("retrieveByCredentials() returns null for an unknown email", () => {
    expect(provider.retrieveByCredentials({ email: "nobody@example.com" })).toBeNull();
  });

  test("validateCredentials() returns true for the correct password", async () => {
    const user = provider.retrieveById(seededUserId)!;
    expect(await provider.validateCredentials(user, { password: "correct-password" })).toBe(true);
  });

  test("validateCredentials() returns false for the wrong password", async () => {
    const user = provider.retrieveById(seededUserId)!;
    expect(await provider.validateCredentials(user, { password: "wrong-password" })).toBe(false);
  });
});
```

Also update the first import line of the file (the `bun:test` import) to include the hooks used above:

```ts
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/auth.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/auth/EloquentUserProvider'`

- [ ] **Step 3: Write minimal implementation**

Widen the visibility of `hydrate` in `src/core/database/Model.ts`. Change (around line 137):

```ts
  protected static hydrate<T extends Model>(data: Record<string, any>): T {
```

to:

```ts
  public static hydrate<T extends Model>(data: Record<string, any>): T {
```

This is a visibility-only change — `QueryBuilder.ts:211` already reaches this method from outside the `Model` hierarchy via a `["hydrate"]` bracket-notation workaround; making it `public` removes the need for that kind of workaround for any future caller. No behavior changes.

Create `src/core/auth/UserProvider.ts`:

```ts
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
```

Create `src/core/auth/EloquentUserProvider.ts`:

```ts
import type { Model } from "../database/Model";
import { Hash } from "../support/Hash";
import type { UserProvider } from "./UserProvider";

export interface EloquentUserProviderOptions {
  usernameField?: string;
  passwordField?: string;
}

/**
 * Default UserProvider, backed by any Bunavel Model subclass
 */
export class EloquentUserProvider<TUser extends Model = Model> implements UserProvider<TUser> {
  private modelClass: typeof Model;
  private usernameField: string;
  private passwordField: string;

  constructor(modelClass: typeof Model, options: EloquentUserProviderOptions = {}) {
    this.modelClass = modelClass;
    this.usernameField = options.usernameField ?? "email";
    this.passwordField = options.passwordField ?? "password";
  }

  public retrieveById(id: string | number): TUser | null {
    return this.modelClass.find<TUser>(id);
  }

  public retrieveByCredentials(credentials: Record<string, any>): TUser | null {
    const value = credentials[this.usernameField];
    if (value === undefined) {
      return null;
    }

    const row = this.modelClass.where(this.usernameField, "=", value).first();
    return row ? this.modelClass.hydrate<TUser>(row) : null;
  }

  public async validateCredentials(user: TUser, credentials: Record<string, any>): Promise<boolean> {
    const hashed = user.get(this.passwordField);
    if (!hashed) {
      return false;
    }
    return Hash.check(credentials.password, hashed);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/unit/auth.test.ts`
Expected: `9 pass, 0 fail` (3 from Task 1 + 6 new)

- [ ] **Step 5: Run the full suite to check for regressions from the `hydrate` visibility change**

Run: `bun test`
Expected: `378 pass, 0 fail` (369 existing + 9 from this file so far)

- [ ] **Step 6: Commit**

```bash
git add src/core/database/Model.ts src/core/auth/UserProvider.ts src/core/auth/EloquentUserProvider.ts tests/unit/auth.test.ts
git commit -m "feat(auth): add UserProvider and EloquentUserProvider"
```

---

### Task 3: `Guard` interface + `TokenGuard`

**Files:**
- Create: `src/core/auth/Guard.ts`
- Create: `src/core/auth/TokenGuard.ts`
- Modify: `tests/unit/auth.test.ts` (append)

**Interfaces:**
- Consumes: `UserProvider<TUser>` (Task 2), `Cache` (`get<T>(key, default?): T | null`, `forever(key, value): boolean`, `forget(key): boolean` — all pre-existing on `src/core/cache/Cache.ts`).
- Produces: `Guard` interface (`attempt`, `login`, `user`, `check`, `guest`, `id`, `logout`). `TokenGuard` class implementing it, constructed as `new TokenGuard(provider, cache)`. Used by `Auth` (Task 4) and the app bootstrap (Task 6).

- [ ] **Step 1: Write the failing test**

Add these imports to the top of `tests/unit/auth.test.ts`, alongside the existing ones:

```ts
import { Cache } from "../../src/core/cache/Cache";
import { TokenGuard } from "../../src/core/auth/TokenGuard";
import { createMockRequest } from "../helpers/test-helpers";
```

Append this describe block at the end of the file:

```ts
describe("TokenGuard", () => {
  let connection: DatabaseConnection;
  let provider: EloquentUserProvider<AuthTestUser>;
  let cache: Cache;
  let guard: TokenGuard;
  let seededUserId: number;

  beforeAll(async () => {
    connection = new DatabaseConnection({ driver: "sqlite", connection: { filename: ":memory:" } });
    connection.connect();
    Model.setConnection(connection);
    Schema.setConnection(connection);

    await Schema.create("auth_test_users", (table) => {
      table.id();
      table.string("email");
      table.string("password");
    });

    const user = new AuthTestUser();
    user.fill({ email: "guard@example.com", password: await Hash.make("correct-password") });
    user.save();
    seededUserId = user.get("id");

    provider = new EloquentUserProvider(AuthTestUser);
    cache = new Cache({ driver: "memory" });
    guard = new TokenGuard(provider, cache);
  });

  afterAll(() => {
    connection.close();
  });

  test("attempt() returns a token for valid credentials", async () => {
    const token = await guard.attempt({ email: "guard@example.com", password: "correct-password" });
    expect(typeof token).toBe("string");
    expect(token!.length).toBeGreaterThan(0);
  });

  test("attempt() returns null for a wrong password", async () => {
    const token = await guard.attempt({ email: "guard@example.com", password: "wrong-password" });
    expect(token).toBeNull();
  });

  test("attempt() returns null for an unknown email", async () => {
    const token = await guard.attempt({ email: "nobody@example.com", password: "correct-password" });
    expect(token).toBeNull();
  });

  test("login() issues a token without checking credentials", () => {
    const user = provider.retrieveById(seededUserId)!;
    const token = guard.login(user);
    expect(typeof token).toBe("string");

    const request = createMockRequest("http://localhost/me", "GET", undefined, {
      Authorization: `Bearer ${token}`,
    });
    expect(guard.user(request)!.get("id")).toBe(seededUserId);
  });

  test("user() returns null when there is no Authorization header", () => {
    const request = createMockRequest("http://localhost/me");
    expect(guard.user(request)).toBeNull();
  });

  test("user() returns null for an unknown token", () => {
    const request = createMockRequest("http://localhost/me", "GET", undefined, {
      Authorization: "Bearer not-a-real-token",
    });
    expect(guard.user(request)).toBeNull();
  });

  test("check() and id() reflect the resolved user", async () => {
    const token = (await guard.attempt({ email: "guard@example.com", password: "correct-password" }))!;
    const request = createMockRequest("http://localhost/me", "GET", undefined, {
      Authorization: `Bearer ${token}`,
    });

    expect(guard.check(request)).toBe(true);
    expect(guard.id(request)).toBe(seededUserId);
  });

  test("logout() revokes the token", async () => {
    const token = (await guard.attempt({ email: "guard@example.com", password: "correct-password" }))!;
    const request = createMockRequest("http://localhost/me", "GET", undefined, {
      Authorization: `Bearer ${token}`,
    });

    expect(guard.check(request)).toBe(true);
    guard.logout(request);
    expect(guard.check(request)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/auth.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/auth/TokenGuard'`

- [ ] **Step 3: Write minimal implementation**

Create `src/core/auth/Guard.ts`:

```ts
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
```

Create `src/core/auth/TokenGuard.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/unit/auth.test.ts`
Expected: `17 pass, 0 fail` (9 from Tasks 1–2 + 8 new)

- [ ] **Step 5: Commit**

```bash
git add src/core/auth/Guard.ts src/core/auth/TokenGuard.ts tests/unit/auth.test.ts
git commit -m "feat(auth): add Guard interface and TokenGuard"
```

---

### Task 4: `Auth` facade

**Files:**
- Create: `src/core/auth/Auth.ts`
- Modify: `tests/unit/auth.test.ts` (append)

**Interfaces:**
- Consumes: `Guard` (Task 3).
- Produces: `Auth.setGuard(guard)`, `Auth.attempt(credentials)`, `Auth.login(user)`, `Auth.user(request)`, `Auth.check(request)`, `Auth.guest(request)`, `Auth.id(request)`, `Auth.logout(request)` — all static. Used by `AuthMiddleware` (Task 5) and `AuthController` (Task 6).

- [ ] **Step 1: Write the failing test**

Add this import to the top of `tests/unit/auth.test.ts`:

```ts
import { Auth } from "../../src/core/auth/Auth";
```

Append these two describe blocks at the end of the file, in this exact order (the first one depends on `Auth.setGuard` never having been called yet anywhere earlier in the file):

```ts
describe("Auth facade - not configured", () => {
  test("throws when no guard has been configured", () => {
    const request = createMockRequest("http://localhost/me");
    expect(() => Auth.check(request)).toThrow(/Auth guard has not been configured/);
  });
});

describe("Auth facade - configured", () => {
  let connection: DatabaseConnection;
  let seededUserId: number;

  beforeAll(async () => {
    connection = new DatabaseConnection({ driver: "sqlite", connection: { filename: ":memory:" } });
    connection.connect();
    Model.setConnection(connection);
    Schema.setConnection(connection);

    await Schema.create("auth_test_users", (table) => {
      table.id();
      table.string("email");
      table.string("password");
    });

    const user = new AuthTestUser();
    user.fill({ email: "facade@example.com", password: await Hash.make("correct-password") });
    user.save();
    seededUserId = user.get("id");

    Auth.setGuard(new TokenGuard(new EloquentUserProvider(AuthTestUser), new Cache({ driver: "memory" })));
  });

  afterAll(() => {
    connection.close();
  });

  test("attempt() delegates to the configured guard", async () => {
    const token = await Auth.attempt({ email: "facade@example.com", password: "correct-password" });
    expect(typeof token).toBe("string");
  });

  test("user(), check() and id() resolve the authenticated user", async () => {
    const token = (await Auth.attempt({ email: "facade@example.com", password: "correct-password" }))!;
    const request = createMockRequest("http://localhost/me", "GET", undefined, {
      Authorization: `Bearer ${token}`,
    });

    expect(Auth.check(request)).toBe(true);
    expect(Auth.id(request)).toBe(seededUserId);
    expect(Auth.user(request)!.get("email")).toBe("facade@example.com");
  });

  test("logout() revokes the token", async () => {
    const token = (await Auth.attempt({ email: "facade@example.com", password: "correct-password" }))!;
    const request = createMockRequest("http://localhost/me", "GET", undefined, {
      Authorization: `Bearer ${token}`,
    });

    Auth.logout(request);
    expect(Auth.check(request)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/auth.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/auth/Auth'`

- [ ] **Step 3: Write minimal implementation**

Create `src/core/auth/Auth.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/unit/auth.test.ts`
Expected: `21 pass, 0 fail` (17 from Tasks 1–3 + 4 new)

- [ ] **Step 5: Commit**

```bash
git add src/core/auth/Auth.ts tests/unit/auth.test.ts
git commit -m "feat(auth): add Auth facade"
```

---

### Task 5: `AuthMiddleware`

**Files:**
- Create: `src/core/auth/AuthMiddleware.ts`
- Modify: `tests/unit/auth.test.ts` (append)

**Interfaces:**
- Consumes: `Auth.guest(request)` (Task 4), `BaseMiddleware` (`src/core/middleware/Middleware.ts`), `UnauthorizedException` (`src/core/exceptions/HttpException.ts`).
- Produces: `AuthMiddleware` class (`extends BaseMiddleware`). Documented as opt-in via `app.use()`, not used by default anywhere in this plan (the app wiring in Task 6 uses the imperative `Auth.check()` pattern instead, since global middleware would lock down every route including `/auth/login`).

- [ ] **Step 1: Write the failing test**

Add these imports to the top of `tests/unit/auth.test.ts`:

```ts
import { AuthMiddleware } from "../../src/core/auth/AuthMiddleware";
import { UnauthorizedException } from "../../src/core/exceptions/HttpException";
```

Append this describe block at the end of the file. It sets up its own connection/user rather than reusing Task 4's, because Task 4's `afterAll` already closed its connection:

```ts
describe("AuthMiddleware", () => {
  let connection: DatabaseConnection;

  beforeAll(async () => {
    connection = new DatabaseConnection({ driver: "sqlite", connection: { filename: ":memory:" } });
    connection.connect();
    Model.setConnection(connection);
    Schema.setConnection(connection);

    await Schema.create("auth_test_users", (table) => {
      table.id();
      table.string("email");
      table.string("password");
    });

    const user = new AuthTestUser();
    user.fill({ email: "middleware@example.com", password: await Hash.make("correct-password") });
    user.save();

    Auth.setGuard(new TokenGuard(new EloquentUserProvider(AuthTestUser), new Cache({ driver: "memory" })));
  });

  afterAll(() => {
    connection.close();
  });

  test("passes an authenticated request through unchanged", async () => {
    const token = (await Auth.attempt({ email: "middleware@example.com", password: "correct-password" }))!;
    const request = createMockRequest("http://localhost/me", "GET", undefined, {
      Authorization: `Bearer ${token}`,
    });

    const middleware = new AuthMiddleware();
    const result = await middleware.handle(request);
    expect(result).toBe(request);
  });

  test("throws UnauthorizedException for a guest request", async () => {
    const request = createMockRequest("http://localhost/me");
    const middleware = new AuthMiddleware();

    await expect(middleware.handle(request)).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/auth.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/auth/AuthMiddleware'`

- [ ] **Step 3: Write minimal implementation**

Create `src/core/auth/AuthMiddleware.ts`:

```ts
import { BaseMiddleware } from "../middleware/Middleware";
import { UnauthorizedException } from "../exceptions/HttpException";
import { Auth } from "./Auth";

/**
 * Rejects guest requests with a 401. Opt-in via app.use() — since this
 * framework only supports global middleware, applying this middleware
 * protects every route, including auth endpoints like /auth/login. Prefer
 * calling Auth.check()/Auth.user() imperatively inside a controller method
 * to protect specific routes.
 */
export class AuthMiddleware extends BaseMiddleware {
  async handle(request: Request): Promise<Request | Response> {
    if (Auth.guest(request)) {
      throw new UnauthorizedException("Unauthenticated.");
    }
    return request;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/unit/auth.test.ts`
Expected: `23 pass, 0 fail` (21 from Tasks 1–4 + 2 new)

- [ ] **Step 5: Run the full unit suite**

Run: `bun test tests/unit`
Expected: all pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add src/core/auth/AuthMiddleware.ts tests/unit/auth.test.ts
git commit -m "feat(auth): add AuthMiddleware"
```

---

### Task 6: Wire auth into the example app

**Files:**
- Create: `database/migrations/20260715000000_create_users_table.ts`
- Modify: `index.ts`
- Modify: `app/models/User.ts`
- Modify: `app/controllers/AuthController.ts`
- Modify: `routes/web.ts`
- Create: `tests/integration/auth.test.ts`

**Interfaces:**
- Consumes: `Auth`, `TokenGuard`, `EloquentUserProvider`, `Hash` (Tasks 1–4), `Application`, `DatabaseConnection`, `Model`, `Schema`, `Cache` (all pre-existing).
- Produces: a working `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` HTTP flow.

Context: `index.ts` currently never creates a `DatabaseConnection` or calls `Model.setConnection` at all, and `database/migrations/` is empty — so `AuthController.register()`/`login()` already crash today the moment they touch the `User` model. This task fixes that as part of making the auth guard demo actually run, using the same `./database.sqlite` file the existing (pre-existing, hardcoded) `MigrateCommand` already targets.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/auth.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Application } from "../../src/core/Application";
import { DatabaseConnection } from "../../src/core/database/Connection";
import { Model } from "../../src/core/database/Model";
import { Schema } from "../../src/core/database/Schema";
import { Cache } from "../../src/core/cache/Cache";
import { Auth } from "../../src/core/auth/Auth";
import { TokenGuard } from "../../src/core/auth/TokenGuard";
import { EloquentUserProvider } from "../../src/core/auth/EloquentUserProvider";
import { User } from "../../app/models/User";
import { AuthController } from "../../app/controllers/AuthController";
import { TestClient } from "../helpers/test-helpers";

const PORT = 34781;

describe("Auth HTTP integration", () => {
  let app: Application;
  let client: TestClient;

  beforeAll(async () => {
    const connection = new DatabaseConnection({ driver: "sqlite", connection: { filename: ":memory:" } });
    connection.connect();
    Model.setConnection(connection);
    Schema.setConnection(connection);

    await Schema.create("users", (table) => {
      table.id();
      table.string("name");
      table.string("email").unique();
      table.string("password");
      table.timestamps();
    });

    Auth.setGuard(new TokenGuard(new EloquentUserProvider(User), new Cache({ driver: "memory" })));

    app = new Application();
    const controller = new AuthController();
    app.getRouter().post("/auth/register", (req) => controller.register(req));
    app.getRouter().post("/auth/login", (req) => controller.login(req));
    app.getRouter().get("/auth/me", (req) => controller.me(req));
    app.getRouter().post("/auth/logout", (req) => controller.logout(req));

    await app.serve(PORT);
    client = new TestClient(`http://localhost:${PORT}`);
  });

  afterAll(async () => {
    await app.stop();
  });

  test("register creates a user and returns a token", async () => {
    const response = await client.post("/auth/register", {
      name: "Jane Doe",
      email: "jane@example.com",
      password: "correct-password",
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user.email).toBe("jane@example.com");
    expect(body.user.password).toBeUndefined();
    expect(typeof body.token).toBe("string");
  });

  test("login with correct credentials returns a token", async () => {
    const response = await client.post("/auth/login", {
      email: "jane@example.com",
      password: "correct-password",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.token).toBe("string");
  });

  test("login with the wrong password is rejected", async () => {
    const response = await client.post("/auth/login", {
      email: "jane@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
  });

  test("/auth/me returns the current user when authenticated", async () => {
    const loginResponse = await client.post("/auth/login", {
      email: "jane@example.com",
      password: "correct-password",
    });
    const { token } = await loginResponse.json();

    const response = await client.get("/auth/me", { Authorization: `Bearer ${token}` });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.email).toBe("jane@example.com");
  });

  test("/auth/me is rejected without a token", async () => {
    const response = await client.get("/auth/me");
    expect(response.status).toBe(401);
  });

  test("logout revokes the token", async () => {
    const loginResponse = await client.post("/auth/login", {
      email: "jane@example.com",
      password: "correct-password",
    });
    const { token } = await loginResponse.json();

    const logoutResponse = await client.post("/auth/logout", {}, { Authorization: `Bearer ${token}` });
    expect(logoutResponse.status).toBe(200);

    const meResponse = await client.get("/auth/me", { Authorization: `Bearer ${token}` });
    expect(meResponse.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/integration/auth.test.ts`
Expected: FAIL — `controller.me is not a function` (or similar; `AuthController` doesn't have `me`/`logout` yet and still uses the dead-end hand-rolled token)

- [ ] **Step 3: Write minimal implementation**

Replace `app/models/User.ts` entirely with:

```ts
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
```

Replace `app/controllers/AuthController.ts` entirely with:

```ts
import { Controller } from "../../src/core/Controller";
import { HttpRequest } from "../../src/core/http/Request";
import { HttpResponse } from "../../src/core/http/Response";
import { validate } from "../../src/core/validation/Validator";
import { Auth } from "../../src/core/auth/Auth";
import { User } from "../models/User";

export class AuthController extends Controller {
  /**
   * Register a new user
   */
  public async register(request: Request): Promise<Response> {
    const httpRequest = new HttpRequest(request);
    const body = await httpRequest.json<{ name: string; email: string; password: string }>();

    const validator = validate(body, {
      name: ["required", "string", { min: 2 }],
      email: ["required", "email"],
      password: ["required", "string", { min: 6 }],
    });

    if (!(await validator.validate())) {
      return HttpResponse.validationError(validator.getErrors());
    }

    const existingUser = User.findByEmail(body.email);
    if (existingUser) {
      return HttpResponse.error("User with this email already exists", 409);
    }

    const user = new User();
    user.fill({
      name: body.name,
      email: body.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await user.setPassword(body.password);
    user.save();

    const token = Auth.login(user);

    return HttpResponse.created({
      message: "User registered successfully",
      user: user.toJson(),
      token,
    });
  }

  /**
   * Login user
   */
  public async login(request: Request): Promise<Response> {
    const httpRequest = new HttpRequest(request);
    const body = await httpRequest.json<{ email: string; password: string }>();

    const validator = validate(body, {
      email: ["required", "email"],
      password: ["required", "string"],
    });

    if (!(await validator.validate())) {
      return HttpResponse.validationError(validator.getErrors());
    }

    const token = await Auth.attempt({ email: body.email, password: body.password });
    if (!token) {
      return HttpResponse.unauthorized("Invalid credentials");
    }

    const user = User.findByEmail(body.email)!;

    return HttpResponse.json({
      message: "Login successful",
      user: user.toJson(),
      token,
    });
  }

  /**
   * Get the currently authenticated user
   */
  public async me(request: Request): Promise<Response> {
    const user = Auth.user(request);
    if (!user) {
      return HttpResponse.unauthorized();
    }

    return HttpResponse.json({ user: user.toJson() });
  }

  /**
   * Log the current user out
   */
  public async logout(request: Request): Promise<Response> {
    Auth.logout(request);
    return HttpResponse.json({ message: "Logged out successfully" });
  }

  /**
   * Get user profile
   */
  public async profile(request: Request, params: Record<string, string>): Promise<Response> {
    const userId = params.id;

    if (!userId) {
      return HttpResponse.error("User ID is required", 400);
    }

    const user = User.find(userId);
    if (!user) {
      return HttpResponse.notFound("User not found");
    }

    return HttpResponse.json({
      user: user.toJson(),
    });
  }
}
```

Update `routes/web.ts` — replace the "Auth routes" block:

```ts
  // Auth routes
  router.post("/auth/register", (req) => authController.register(req));
  router.post("/auth/login", (req) => authController.login(req));
  router.get("/auth/me", (req) => authController.me(req));
  router.post("/auth/logout", (req) => authController.logout(req));
  router.get("/users/{id}", (req, params) => authController.profile(req, params));
```

Create `database/migrations/20260715000000_create_users_table.ts`:

```ts
import { Migration } from "../../src/core/database/Migration";
import { Schema } from "../../src/core/database/Schema";

/**
 * CreateUsersTable Migration
 */
export default class CreateUsersTable extends Migration {
  /**
   * Run the migration
   */
  async up(): Promise<void> {
    await Schema.create("users", (table) => {
      table.id();
      table.string("name").notNullable();
      table.string("email").notNullable().unique();
      table.string("password").notNullable();
      table.timestamps();
    });
  }

  /**
   * Reverse the migration
   */
  async down(): Promise<void> {
    await Schema.dropIfExists("users");
  }
}
```

Update `index.ts` — replace the whole file with:

```ts
import { Application } from "./src/core/Application";
import { registerRoutes } from "./routes/web";
import { LoggerMiddleware } from "./app/middleware/LoggerMiddleware";
import { DatabaseConnection } from "./src/core/database/Connection";
import { Model } from "./src/core/database/Model";
import { Cache } from "./src/core/cache/Cache";
import { Auth } from "./src/core/auth/Auth";
import { TokenGuard } from "./src/core/auth/TokenGuard";
import { EloquentUserProvider } from "./src/core/auth/EloquentUserProvider";
import { User } from "./app/models/User";

// Create application instance
const app = new Application();

// Configure the application
app.setConfig({
  name: "Bunavel",
  env: "development",
  debug: true,
});

// Connect to the database (run `bun run artisan migrate` first) and
// configure the auth guard
const connection = new DatabaseConnection({
  driver: "sqlite",
  connection: { filename: "./database.sqlite" },
});
connection.connect();
Model.setConnection(connection);

const authCache = new Cache({ driver: "memory" });
Auth.setGuard(new TokenGuard(new EloquentUserProvider(User), authCache));

// Register middleware
app.use(new LoggerMiddleware());

// Register routes
registerRoutes(app.getRouter());

// Start the server
const port = Number(process.env.PORT) || 3000;
app.serve(port);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/integration/auth.test.ts`
Expected: `6 pass, 0 fail`

- [ ] **Step 5: Run the full suite**

Run: `bun test`
Expected: all pass, no regressions (369 pre-existing + 23 from `tests/unit/auth.test.ts` + 6 from `tests/integration/auth.test.ts`)

- [ ] **Step 6: Commit**

```bash
git add database/migrations/20260715000000_create_users_table.ts index.ts app/models/User.ts app/controllers/AuthController.ts routes/web.ts tests/integration/auth.test.ts
git commit -m "feat(auth): wire Auth guard into the example app"
```

---

### Task 7: Barrel exports

**Files:**
- Modify: `src/index.ts`
- Modify: `tests/unit/auth.test.ts` (append)

**Interfaces:**
- Consumes: `Auth`, `Guard`, `TokenGuard`, `UserProvider`, `EloquentUserProvider`, `EloquentUserProviderOptions`, `AuthMiddleware` (Tasks 1–5), `Hash` (Task 1).
- Produces: public package exports — this is the last task, no downstream consumers within this plan.

- [ ] **Step 1: Write the failing test**

Append this describe block at the end of `tests/unit/auth.test.ts`:

```ts
describe("src/index.ts barrel exports", () => {
  test("exports the auth module", async () => {
    const barrel = await import("../../src/index");
    expect(typeof barrel.Auth).toBe("function");
    expect(typeof barrel.TokenGuard).toBe("function");
    expect(typeof barrel.EloquentUserProvider).toBe("function");
    expect(typeof barrel.AuthMiddleware).toBe("function");
    expect(typeof barrel.Hash).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/unit/auth.test.ts`
Expected: FAIL — `barrel.Auth` is `undefined`, `expect(typeof barrel.Auth).toBe("function")` fails

- [ ] **Step 3: Write minimal implementation**

Append this block at the end of `src/index.ts`:

```ts

// Auth
export { Auth } from "./core/auth/Auth";
export type { Guard } from "./core/auth/Guard";
export { TokenGuard } from "./core/auth/TokenGuard";
export type { UserProvider } from "./core/auth/UserProvider";
export { EloquentUserProvider, type EloquentUserProviderOptions } from "./core/auth/EloquentUserProvider";
export { AuthMiddleware } from "./core/auth/AuthMiddleware";
export { Hash } from "./core/support/Hash";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/unit/auth.test.ts`
Expected: `24 pass, 0 fail` (23 from Tasks 1–5 + 1 new)

- [ ] **Step 5: Run the full suite**

Run: `bun test`
Expected: all pass, no regressions (369 pre-existing + 24 unit + 6 integration = 399)

- [ ] **Step 6: Commit**

```bash
git add src/index.ts tests/unit/auth.test.ts
git commit -m "feat(auth): export auth module from src/index.ts"
```

---

## Self-Review Notes

- **Spec coverage:** `Hash` (Task 1), `UserProvider`/`EloquentUserProvider` (Task 2), `Guard`/`TokenGuard` (Task 3), `Auth` facade (Task 4), `AuthMiddleware` (Task 5), app wiring incl. the `Model.hydrate` visibility fix and the previously-missing DB bootstrap (Task 6), barrel exports (Task 7) — every component in the spec has a task.
- **Non-goals respected:** no route groups/prefixes were added; `AuthMiddleware` exists but nothing in this plan applies it globally, matching the spec's documented limitation.
- **Type consistency checked:** `Guard`/`TokenGuard`/`Auth` all agree on `attempt(credentials): Promise<string | null>`, `login(user): string`, `user/check/guest/id/logout(request: Request)`. `UserProvider`/`EloquentUserProvider` agree on `retrieveById`, `retrieveByCredentials`, `validateCredentials`. `EloquentUserProvider` and `Auth`'s bootstrap in Task 6 both use `new EloquentUserProvider(User)` (default `usernameField: "email"`, `passwordField: "password"`, matching the real `users` table columns).
