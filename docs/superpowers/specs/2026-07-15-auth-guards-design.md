# Auth Guards — Design

## Summary

Add a Laravel-style authentication system to Bunavel: a static `Auth` facade backed
by a pluggable `Guard`, one concrete `TokenGuard` implementation (opaque bearer
tokens, Sanctum-style), a `UserProvider` abstraction so the guard isn't coupled to
a specific model, and a `Hash` facade wrapping `Bun.password` (bcrypt) to replace
the unsalted SHA-256 currently used for passwords.

This closes two real gaps: there is no way to protect a route today, and the
existing `AuthController.login()` generates a "token" that is never stored
anywhere, so it can never be verified on a later request.

## Non-goals

- Route-group / per-route middleware. The framework only supports global
  middleware today (`app.use()` applies to every route). Building group/prefix
  routing is a separate, larger feature and out of scope here. `AuthMiddleware`
  is shipped for completeness but documented as "locks down all routes if used
  globally" — the primary protection pattern is calling `Auth.check(request)`
  imperatively inside a controller method.
- Session/cookie-based guards. Only a token guard is built. The `Guard`
  interface is designed so a `SessionGuard` could be added later without
  changing `Auth` or `UserProvider`.
- Multiple named guards / config-driven guard selection (Laravel's
  `config/auth.php`). `Auth` holds a single active guard, set once via
  `Auth.setGuard()`.
- Hashed-at-rest tokens (Laravel Sanctum stores a hash of the token, not the
  plaintext). This implementation stores the plaintext token in `Cache`,
  matching the simplicity level of the rest of the framework. Noted as a known
  simplification, not a production hardening step.
- Remember-me tokens, password resets, email verification — not requested.

## Architecture

```
src/core/support/Hash.ts          Hash.make() / Hash.check() over Bun.password
src/core/auth/
  UserProvider.ts                 interface: retrieveById, retrieveByCredentials, validateCredentials
  EloquentUserProvider.ts         default UserProvider backed by a Model subclass
  Guard.ts                        interface: attempt, login, user, check, id, logout
  TokenGuard.ts                   Guard impl backed by the existing Cache system
  Auth.ts                         static facade, mirrors Env's static-class convention
  AuthMiddleware.ts               optional global middleware, 401s guests
```

`Auth` is a static facade (matching the existing `Env` pattern in
`src/core/config/Env.ts`) so it can be called from anywhere without DI
plumbing. It requires one-time setup:

```ts
Auth.setGuard(new TokenGuard(new EloquentUserProvider(User), cache));
```

### `UserProvider` interface

```ts
interface UserProvider<TUser = any> {
  retrieveById(id: string | number): TUser | null;
  retrieveByCredentials(credentials: Record<string, any>): TUser | null;
  validateCredentials(user: TUser, credentials: Record<string, any>): Promise<boolean>;
}
```

`EloquentUserProvider` implements this against a `Model` subclass:

```ts
new EloquentUserProvider(User, {
  usernameField: "email",   // default "email"
  passwordField: "password" // default "password"
});
```

- `retrieveById` → `Model.find(id)` (already public, already hydrated)
- `retrieveByCredentials` → `Model.where(usernameField, "=", value).first()` then
  `Model.hydrate(row)`. `QueryBuilder.first()`/`.get()` return plain rows, not
  model instances (confirmed via `User.findByEmail`, which hydrates manually) —
  see below, this requires widening `Model.hydrate` from `protected static` to
  `public static`.
- `validateCredentials` → `Hash.check(credentials.password, user.get(passwordField))`

### `Guard` interface

```ts
interface Guard {
  attempt(credentials: Record<string, any>): Promise<string | null>; // → token
  login(user: any): string;                                          // → token, no credential check
  user(request: Request): any | null;
  check(request: Request): boolean;
  id(request: Request): string | number | null;
  logout(request: Request): void;
}
```

### `TokenGuard`

- Constructed with a `UserProvider` and a `Cache` instance.
- Token format: `crypto.randomUUID()` (Bun/Web Crypto, already global — no new
  dependency).
- Storage key: `` `auth_token:${token}` `` → `userId`, stored via
  `cache.forever()` (no expiry; `logout()` is the revocation path).
- `attempt(credentials)`: `provider.retrieveByCredentials(credentials)` →  if
  found, `provider.validateCredentials(user, credentials)` → if valid, mint a
  token, store it, return it. Returns `null` on any failure (user not found or
  bad password) — same external behavior `AuthController.login` has today.
- `login(user)`: skips credential validation, mints + stores a token directly
  for a given user record (matches Laravel's `Auth::login($user)`, used e.g.
  right after registration).
- `user(request)`: reads `Authorization: Bearer <token>` header; no header or
  unknown token → `null`; else `cache.get()` the userId and
  `provider.retrieveById(userId)`.
- `check`/`id` are derived from `user()`.
- `logout(request)`: extracts the token from the header and `cache.forget()`s
  it. No-op if there's no token.

### `Auth` facade

Static passthrough to the currently-set guard; throws a clear error if a
method is called before `Auth.setGuard()` (mirrors how `Env` auto-loads, but
`Auth` can't auto-construct a guard since it depends on app-specific model +
cache).

### `AuthMiddleware`

```ts
class AuthMiddleware extends BaseMiddleware {
  async handle(request: Request): Promise<Request | Response> {
    if (Auth.guest(request)) {
      throw new UnauthorizedException("Unauthenticated.");
    }
    return request;
  }
}
```

Thrown exception is caught by the existing `ExceptionHandler` (same pattern
every other `HttpException` subclass already uses), producing a 401 JSON
response with no new error-handling code needed.

### `Hash`

```ts
class Hash {
  static async make(plain: string): Promise<string> {
    return Bun.password.hash(plain); // bcrypt by default
  }
  static async check(plain: string, hashed: string): Promise<boolean> {
    return Bun.password.verify(plain, hashed);
  }
}
```

## Data flow

- **Register**: `AuthController.register` → validate → create `User` →
  `await user.setPassword(password)` (now calls `Hash.make` internally) →
  save → `Auth.login(user)` to issue a token immediately, so registration
  returns a usable session like login does.
- **Login**: `AuthController.login` → validate → `await Auth.attempt({ email,
  password })` → `null` → 401 `"Invalid credentials"` (unchanged external
  behavior); token → 200 with `{ user, token }`.
- **Authenticated request**: client sends `Authorization: Bearer <token>`;
  controller calls `Auth.user(request)` / `Auth.check(request)` directly.
- **Logout**: `POST /auth/logout` → `Auth.logout(request)` → 200.

## Error handling

- Invalid credentials on login/attempt → `null`, controller returns existing
  `HttpResponse.unauthorized(...)`.
- Missing/invalid/expired token when calling a protected controller method →
  controller checks `Auth.check(request)` and returns
  `HttpResponse.unauthorized()` itself (imperative style, consistent with the
  rest of `AuthController`).
- `AuthMiddleware`, if opted into via `app.use()`, throws `UnauthorizedException`
  → handled by the existing `ExceptionHandler` → 401 JSON.
- Calling any `Auth.*` method before `Auth.setGuard()` throws a descriptive
  `Error` (programmer error, fails fast, not caught/mapped to HTTP).

## Touches to existing code

- `src/core/database/Model.ts` — widen `hydrate` from `protected static` to
  `public static`. It currently has one caller outside a `Model` subclass
  already (`QueryBuilder` reaches it via `this.modelClass!["hydrate"](row)`,
  a bracket-notation workaround for the same visibility problem), so this is
  a visibility correction, not new capability — `EloquentUserProvider` needs
  to hydrate rows returned by an arbitrary-column `where()` lookup the same
  way `User.findByEmail` already does. No behavior change.
- `app/models/User.ts` — `setPassword`/`verifyPassword` delegate to `Hash`
  instead of raw `Bun.CryptoHasher("sha256")`. Method signatures unchanged.
- `app/controllers/AuthController.ts` — remove the private `generateToken()`
  (dead-end token, never stored); `register`/`login` use `Auth.login`/
  `Auth.attempt`; add `me(request)` (returns `Auth.user(request)` or 401) and
  `logout(request)`.
- `routes/web.ts` — add `GET /auth/me`, `POST /auth/logout`.
- `index.ts` — construct a `Cache` instance and call `Auth.setGuard(new
  TokenGuard(new EloquentUserProvider(User), cache))` at bootstrap, before
  `registerRoutes`.
- `src/index.ts` — export `Auth`, `Guard`, `TokenGuard`, `UserProvider`,
  `EloquentUserProvider`, `AuthMiddleware`, `Hash`.

## Testing

New `tests/unit/auth.test.ts`:
- `Hash.make`/`Hash.check` round-trip (correct password passes, wrong
  password fails, hash is not the plaintext).
- `TokenGuard`: attempt with valid/invalid credentials, login (direct),
  user() resolution from a valid/invalid/missing bearer token, check/id
  derivation, logout revokes the token (subsequent `user()` call returns
  `null`).
- `Auth` facade: delegates to the configured guard; throws if called before
  `setGuard`.
- `AuthMiddleware`: passes through an authenticated request, throws
  `UnauthorizedException` for a guest.

Existing tests that touch `User.setPassword`/`verifyPassword` should keep
passing unchanged (black-box behavior preserved — only the hashing algorithm
changed).
