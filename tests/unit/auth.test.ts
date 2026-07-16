import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Hash } from "../../src/core/support/Hash";
import { Model } from "../../src/core/database/Model";
import { Schema } from "../../src/core/database/Schema";
import { DatabaseConnection } from "../../src/core/database/Connection";
import { EloquentUserProvider } from "../../src/core/auth/EloquentUserProvider";
import { Cache } from "../../src/core/cache/Cache";
import { TokenGuard } from "../../src/core/auth/TokenGuard";
import { Auth } from "../../src/core/auth/Auth";
import { createMockRequest } from "../helpers/test-helpers";
import { AuthMiddleware } from "../../src/core/auth/AuthMiddleware";
import { UnauthorizedException } from "../../src/core/exceptions/HttpException";

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

class AuthTestUser extends Model {
  static override tableName = "auth_test_users";
}

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
