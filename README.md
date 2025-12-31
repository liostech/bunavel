# Bunavel

A Laravel-inspired web framework for Bun and TypeScript. Built for speed, simplicity, and developer experience.

## Features

- **Fast**: Built on Bun's lightning-fast runtime
- **Type-Safe**: Full TypeScript support with type inference
- **Laravel-Inspired**: Familiar API for Laravel developers
- **Modern**: ESM-first with modern JavaScript features
- **Batteries Included**: Routing, middleware, validation, ORM, and more

## Installation

```bash
bun install
```

## Quick Start

```typescript
import { Application } from "./src/core/Application";

const app = new Application();

// Register routes
app.getRouter().get("/", () => {
  return new Response("Hello, Bunavel!");
});

// Start server
app.serve(3000);
```

## Core Features

### 1. Routing

Laravel-style routing with parameter extraction:

```typescript
const router = app.getRouter();

// Basic routes
router.get("/", handler);
router.post("/users", handler);
router.put("/users/{id}", handler);
router.delete("/users/{id}", handler);

// Route parameters
router.get("/users/{id}", (req, params) => {
  return HttpResponse.json({ id: params.id });
});
```

### 2. Controllers

```typescript
import { Controller } from "./src/core/Controller";

export class UserController extends Controller {
  public async index(request: Request): Promise<Response> {
    return this.json({ users: [] });
  }

  public async show(request: Request, params: Record<string, string>): Promise<Response> {
    return this.json({ id: params.id });
  }
}
```

### 3. Middleware

```typescript
import { BaseMiddleware } from "./src/core/middleware/Middleware";

export class LoggerMiddleware extends BaseMiddleware {
  async handle(request: Request): Promise<Request> {
    console.log(`${request.method} ${new URL(request.url).pathname}`);
    return request;
  }
}

// Register middleware
app.use(new LoggerMiddleware());
```

**Built-in Middleware:**
- `CorsMiddleware` - CORS support
- `RateLimitMiddleware` - Rate limiting
- `LoggerMiddleware` - Request logging

### 4. Database & ORM

**Query Builder:**

```typescript
import { QueryBuilder, DatabaseConnection } from "./src";

const connection = new DatabaseConnection({
  driver: "sqlite",
  connection: { filename: "./database.sqlite" }
});
connection.connect();

const users = new QueryBuilder(connection)
  .table("users")
  .where("active", "=", true)
  .orderBy("created_at", "DESC")
  .limit(10)
  .get();
```

**Eloquent-like Models:**

```typescript
import { Model } from "./src/core/database/Model";

export class User extends Model {
  protected static override tableName = "users";
}

// Usage
const users = User.all();
const user = User.find(1);
const user = User.where("email", "=", "test@example.com").first();

// Create
const user = User.create({
  name: "John Doe",
  email: "john@example.com"
});

// Update
user.set("name", "Jane Doe");
user.save();

// Delete
user.delete();
```

### 5. Validation

Laravel-inspired validation:

```typescript
import { validate } from "./src/core/validation/Validator";

const validator = validate(data, {
  name: ["required", "string", { min: 2 }],
  email: ["required", "email"],
  age: ["number", { min: 18 }],
  website: ["url"],
});

if (await validator.validate()) {
  const validated = validator.validated();
} else {
  const errors = validator.getErrors();
  return HttpResponse.validationError(errors);
}
```

**Available Rules:**
- `required` - Field must be present
- `string` - Must be a string
- `number` - Must be a number
- `boolean` - Must be a boolean
- `email` - Must be valid email
- `url` - Must be valid URL
- `array` - Must be an array
- `object` - Must be an object
- `{ min: n }` - Minimum length/value
- `{ max: n }` - Maximum length/value
- `{ in: [...] }` - Must be in array
- `{ pattern: /.../ }` - Must match regex
- `{ custom: fn }` - Custom validation function

### 6. HTTP Helpers

**Request:**

```typescript
import { HttpRequest } from "./src/core/http/Request";

const req = new HttpRequest(request, params);

// Query parameters
const page = req.query("page", "1");
const all = req.all();

// Route parameters
const id = req.param("id");

// Headers
const auth = req.header("authorization");

// Body
const data = await req.json();
const text = await req.text();
const form = await req.formData();

// Helpers
req.isJson();
req.wantsJson();
req.ip();
```

**Response:**

```typescript
import { HttpResponse } from "./src/core/http/Response";

// JSON response
return HttpResponse.json({ data: "value" });

// With status
return HttpResponse.json({ error: "Not found" }, 404);

// Helpers
return HttpResponse.created(data);
return HttpResponse.notFound();
return HttpResponse.unauthorized();
return HttpResponse.forbidden();
return HttpResponse.validationError(errors);
return HttpResponse.redirect("/login");
return HttpResponse.download(content, "file.pdf");
```

### 7. Environment Configuration

```typescript
import { Env } from "./src/core/config/Env";

// Get values
const appName = Env.get("APP_NAME", "Bunavel");
const port = Env.getNumber("APP_PORT", 3000);
const debug = Env.getBoolean("APP_DEBUG", false);

// Required values
const apiKey = Env.getOrFail("API_KEY");
```

Create a `.env` file:

```env
APP_NAME=Bunavel
APP_ENV=development
APP_PORT=3000
DB_DRIVER=sqlite
DB_FILENAME=./storage/database.sqlite
```

### 8. Dependency Injection

```typescript
const container = app.getContainer();

// Bind services
container.bind("service", () => new MyService());

// Singleton
container.singleton("database", () => {
  const conn = new DatabaseConnection(config);
  conn.connect();
  return conn;
});

// Resolve
const service = container.make<MyService>("service");
```

## Project Structure

```
bunavel/
├── app/
│   ├── controllers/     # Application controllers
│   ├── models/          # Database models
│   └── middleware/      # Custom middleware
├── config/              # Configuration files
├── routes/              # Route definitions
│   └── web.ts
├── src/                 # Framework core
│   └── core/
│       ├── Application.ts
│       ├── Controller.ts
│       ├── routing/
│       ├── middleware/
│       ├── database/
│       ├── validation/
│       ├── http/
│       └── config/
├── storage/             # Storage for logs, cache, database
├── public/              # Public assets
├── index.ts             # Application entry point
└── package.json
```

## Example Application

Check out the included example application with:
- User registration and authentication
- CRUD operations
- Validation
- Middleware
- Database models

## Development

```bash
# Run development server with hot reload
bun run dev

# Run production server
bun start

# Run tests
bun test

# Run tests in watch mode
bun test:watch

# Run tests with coverage
bun test:coverage
```

## Testing

Bunavel includes a comprehensive test suite with **65+ tests** covering:
- ✅ Router and routing with parameters
- ✅ Validation with all rules
- ✅ Database query builder
- ✅ Middleware system
- ✅ HTTP helpers

**Test Results:**
```
✓ 65 pass
✓ 0 fail
✓ 109 expect() calls
```

For detailed testing documentation, see [docs/TESTING.md](docs/TESTING.md)

### Quick Test Example

```typescript
import { describe, test, expect } from "bun:test";
import { validate } from "./src/core/validation/Validator";

describe("Validation", () => {
  test("should validate email", async () => {
    const validator = validate(
      { email: "test@example.com" },
      { email: ["required", "email"] }
    );

    expect(await validator.validate()).toBe(true);
  });
});
```

## Configuration

Configure your application in `index.ts`:

```typescript
import { Application } from "./src/core/Application";
import { Env } from "./src/core/config/Env";

const app = new Application();

// Set configuration
app.setConfig({
  name: Env.get("APP_NAME", "Bunavel"),
  env: Env.get("APP_ENV", "production"),
  debug: Env.getBoolean("APP_DEBUG", false),
});

// Register middleware
app.use(new CorsMiddleware({
  origin: Env.get("CORS_ORIGIN", "*"),
}));

app.use(new RateLimitMiddleware(
  Env.getNumber("RATE_LIMIT_MAX", 60),
  Env.getNumber("RATE_LIMIT_WINDOW", 60000)
));

// Start server
const port = Env.getNumber("APP_PORT", 3000);
app.serve(port);
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
