# Route Groups, Prefixes & Named Routes — Design

## Summary

Add Laravel-style route grouping to Bunavel's `Router`: `prefix()`, per-group and
per-route `middleware()`, and `name()` with a `route(name, params)` reverse
resolver. This is the first of a sequence of remaining Laravel-parity features
(route groups → query scopes → soft deletes → model lifecycle hooks →
sessions → API resources).

This closes a real gap surfaced while building Auth Guards: the framework only
supports *global* middleware (`app.use()`, applied to every request before
routing), so `AuthMiddleware` cannot be applied to just `/auth/me` while
leaving `/auth/login` public. Route groups fix that at the source.

## Non-goals

- Route caching / compiled route tables (Laravel's `route:cache`) — not
  requested, and this framework has no build step to hang it on.
- Automatic RESTful resource routing (`Route::resource(...)`) — a separate,
  later feature if wanted.
- Route model binding (`Route::get('/users/{user}', ...)` auto-resolving a
  `User` model) — separate feature.
- Domain routing / subdomain groups — not requested.
- Changing how the *global* `app.use()` middleware behaves — it keeps running
  for every request, before routing, exactly as today. Only route-specific
  (group + per-route) middleware is new.

## API

### Grouping

```ts
router.group({ prefix: "api", middleware: [authMw], name: "api." }, (router) => {
  router.get("/users", handler).name("users.index");

  router.group({ prefix: "v1" }, (router) => {
    router.get("/posts", handler).middleware(rateLimitMw).name("posts.index");
    // → GET /api/v1/posts, middleware = [authMw, rateLimitMw] (outer→inner
    //   order), name = "api.posts.index"
  });
});
```

`GroupOptions` (all fields optional — an empty `{}` group is legal, just for
scoping a callback with no prefix/middleware/name):

```ts
interface GroupOptions {
  prefix?: string;
  middleware?: Middleware[];
  name?: string;
}
```

`router.group(options, callback)` pushes `options` onto an internal
`groupStack`, calls `callback(this)` synchronously (route registration is
always synchronous setup code — no route handler ever runs during
registration), then pops the stack. Nesting works because each `add()` call
reads the *current* full stack, not just the immediate parent.

### Per-route builder

`router.get/post/put/patch/delete(path, handler)` now return a `RouteBuilder`
instead of `void`:

```ts
class RouteBuilder {
  middleware(...middleware: Middleware[]): this;  // appended after any group middleware
  name(name: string): this;                        // prefixed with accumulated group name(s)
}
```

Existing call sites that ignore the return value (all of them, today) are
unaffected — this is purely additive.

### Accumulation rules (evaluated at `add()`-registration time, from the group stack outermost→innermost, then the route's own `.middleware()`/`.name()` calls on top)

- **Path:** each enclosing group's `prefix` is path-joined outer→inner, then
  the route's own path, with slash-normalization so `prefix: "/api/"` +
  `path: "users"` both produce `/api/users` (no double or missing slashes).
- **Middleware:** `[...group1.middleware, ...group2.middleware, ..., ...routeOwnMiddleware]`
  — outer groups' middleware runs first, route-specific `.middleware()` calls
  run last, immediately before the handler.
- **Name:** plain string concatenation of each enclosing group's `name` (in
  order) plus whatever the route's own `.name()` call supplies. No dot is
  inserted automatically — mirrors Laravel exactly, where the convention of
  writing `name: "users."` with a trailing dot is the caller's choice, not
  framework logic.

### Named route resolution

```ts
router.route(name: string, params: Record<string, string | number> = {}): string
```

Looks up the route by exact `name` match, substitutes `{param}` placeholders
in its (already prefix-resolved) path, and returns the resulting string.
Throws a plain `Error("Route [name] not defined.")` if no route has that
name — matching the existing `Container.make()` precedent in this codebase
for "not found" lookups (a plain `Error`, not an `HttpException`), since this
is a programmer-facing lookup failure (e.g. inside a handler building a
redirect URL), not something that should auto-render as an HTTP error page.

## Execution model change

Today, `Application.serve()`'s `fetch` handler:
1. Runs every `app.use()`-registered middleware over the raw request.
2. Matches the route.
3. Calls the handler.

This adds a step between 2 and 3: after a route matches, run *that route's*
accumulated middleware (group + per-route) the same way global middleware
already runs — each middleware either returns a (possibly modified) `Request`
to continue, or a `Response` to short-circuit. Global middleware is
unaffected: it still runs first, for every request, including ones that will
404 (so `LoggerMiddleware`, `CorsMiddleware`, etc. keep seeing 404s).

The middleware-running loop is duplicated between the two passes today
conceptually — this change extracts it into one private
`runMiddleware(middleware: Middleware[], request: Request): Promise<Request | Response>`
helper on `Application`, used for both the global pass and the route-specific
pass, since I'm already touching this exact method.

`Router.match()`'s return type gains a `middleware: Middleware[]` field
(the route's fully-resolved chain) alongside the existing `handler` and
`params`.

## Data flow

- **Route registration:** `router.group(...)` / `router.get(...).middleware(...).name(...)`
  all happen synchronously at app-bootstrap time (in `routes/web.ts` or
  wherever routes are registered), before `app.serve()` is ever called.
- **Request handling:** `Application.serve()`'s `fetch` → global middleware →
  `router.match()` → route-specific middleware → handler. A route-specific
  middleware returning a `Response` (e.g. `AuthMiddleware` throwing/short-
  circuiting on a guest) stops the chain before the handler runs, exactly
  like global middleware does today.
- **Reverse resolution:** any handler can call `router.route(name, params)`
  (the `Router` instance is reachable via `app.getContainer().make("router")`
  or however the handler already has a reference) to build a URL for a
  redirect or response body.

## Error handling

- No route named `X` when `router.route("X")` is called → plain
  `Error("Route [X] not defined.")`, uncaught by the framework (same as
  `Container.make()`'s unbound-key error today) — a setup/programmer error,
  not a request-time HTTP error.
- A route-specific middleware throwing an `HttpException` (e.g.
  `AuthMiddleware` throwing `UnauthorizedException`) is caught by the same
  top-level `try/catch` in `Application.serve()` that already handles
  exceptions thrown by global middleware and handlers today — no new
  error-handling code needed.

## Touches to existing code

- `src/core/routing/Router.ts` — add `GroupOptions`, `RouteBuilder`, the
  `groupStack`, path-joining/middleware/name accumulation logic in `add()`,
  and the `route()` reverse resolver. `match()`'s return type gains
  `middleware`.
- `src/core/Application.ts` — extract `runMiddleware()` helper; run
  route-specific middleware between matching and handler invocation.
- `src/index.ts` — export `GroupOptions`, `RouteBuilder`.

No existing route registrations (`routes/web.ts`, `AuthController` wiring)
need to change — this is purely additive; nothing currently uses groups, so
nothing currently relies on the old `add()` returning `void`.

## Testing

Extend `tests/unit/router.test.ts`:
- Group registers a prefixed path (`/api` + `/users` → `/api/users`).
- Nested groups path-join correctly (`/api` + `/v1` + `/users` → `/api/v1/users`).
- Group middleware appears on the matched route's `middleware` array, in
  outer→inner order; per-route `.middleware()` appends after group middleware.
- Group `name` + per-route `.name()` concatenate correctly; `router.route(name, params)`
  substitutes params and returns the right path; throws for an unknown name.
- Existing "no groups used" tests continue to pass unchanged (backward
  compatibility).

New middleware-ordering test (real `Application.serve()`, real HTTP, no
mocks — same pattern as the auth integration test): a group-protected route
rejects an unauthenticated request before the handler runs, while a sibling
ungrouped route is unaffected; global middleware still runs for a 404.
