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

**Relationships:**

```typescript
export class User extends Model {
  protected static override tableName = "users";

  // One-to-one
  profile(): HasOne<Profile> {
    return this.hasOne(Profile, "user_id", "id");
  }

  // One-to-many
  posts(): HasMany<Post> {
    return this.hasMany(Post, "user_id", "id");
  }

  // Many-to-many
  roles(): BelongsToMany<Role> {
    return this.belongsToMany(Role, "role_user", "user_id", "role_id");
  }
}

// Usage
const user = User.find(1);
const profile = await user.profile().get();
const posts = await user.posts().get();
const roles = await user.roles().get();
```

**Eager Loading:**

```typescript
// Eager load relationships to avoid N+1 queries
const users = User.with("profile", "posts").get();
// users[0].profile and users[0].posts are pre-loaded

// Lazy loading
const user = User.find(1);
await user.load("posts", "profile");
const posts = user.getRelation("posts");
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

### 8. Caching

Bunavel provides a flexible caching system with multiple drivers:

```typescript
import { Cache } from "./src/core/cache/Cache";

// Create cache instance with memory driver
const cache = new Cache({ driver: "memory" });

// Or use file driver for persistence
const cache = new Cache({ 
  driver: "file",
  path: "./storage/cache"
});

// Store values
cache.put("key", "value", 60); // TTL in seconds
cache.forever("key", "value"); // Store forever

// Retrieve values
const value = cache.get("key");
const withDefault = cache.get("key", "default");

// Check existence
if (cache.has("key")) {
  // Key exists
}

// Remember (cache result of callback)
const users = cache.remember("users", 60, () => {
  return User.all(); // Only called if not cached
});

// Increment/Decrement
cache.put("views", 0);
cache.increment("views"); // 1
cache.increment("views", 5); // 6
cache.decrement("views"); // 5

// Remove items
cache.forget("key");
cache.forgetMany(["key1", "key2"]);
cache.flush(); // Clear all cache

// Pull (get and remove)
const value = cache.pull("key");

// Add (only if not exists)
cache.add("key", "value", 60);
```

**Available Drivers:**
- `memory` - In-memory cache (fast, but lost on restart)
- `file` - File-based cache (persists between restarts)

**Cache with Prefix:**

```typescript
const cache = new Cache({
  driver: "memory",
  prefix: "myapp" // All keys prefixed with "myapp:"
});
```

### 9. Event System

Bunavel provides a powerful event system for decoupling application logic:

```typescript
import { Event, BaseListener, EventDispatcher } from "./src";

// Define events
class UserRegistered extends Event {
  constructor(
    public readonly userId: number,
    public readonly email: string
  ) {
    super();
  }
}

// Define listeners
class SendWelcomeEmail extends BaseListener<UserRegistered> {
  async handle(event: UserRegistered): Promise<void> {
    // Send welcome email logic
    console.log(`Sending welcome email to ${event.email}`);
  }
}

class CreateUserProfile extends BaseListener<UserRegistered> {
  async handle(event: UserRegistered): Promise<void> {
    // Create user profile logic
    console.log(`Creating profile for user ${event.userId}`);
  }
}

// Register listeners
const dispatcher = new EventDispatcher();
dispatcher.listen(UserRegistered, new SendWelcomeEmail());
dispatcher.listen(UserRegistered, new CreateUserProfile());

// Or use inline function listeners
dispatcher.listen(UserRegistered, (event) => {
  console.log(`User ${event.userId} registered`);
});

// Dispatch events
const event = new UserRegistered(1, "user@example.com");
await dispatcher.dispatch(event);

// Fire and forget (don't wait for listeners)
dispatcher.fire(event);

// Wildcard listeners (listen to all events)
dispatcher.listenAll((event: Event) => {
  console.log(`Event occurred: ${event.constructor.name}`);
});
```

**Event System Features:**
- Type-safe event and listener definitions
- Multiple listeners per event
- Async listener support
- Wildcard listeners for all events
- Error handling (one listener error won't stop others)
- Listener management (forget, flush, check existence)

### 10. Queue System

Bunavel provides a comprehensive queue system for background job processing:

```typescript
import { BaseJob, Queue, MemoryQueueDriver, SyncQueueDriver } from "./src";

// Define a job
class SendEmailJob extends BaseJob {
  constructor(
    private to: string,
    private subject: string,
    private body: string
  ) {
    super();
    this.tries = 3;         // Retry up to 3 times
    this.retryAfter = 60;   // Wait 60 seconds before retry
  }

  async handle(): Promise<void> {
    // Job logic here
    console.log(`Sending email to ${this.to}`);
    // await sendEmail(this.to, this.subject, this.body);
  }

  async failed(error: Error): Promise<void> {
    // Handle failure after max retries
    console.error(`Failed to send email to ${this.to}:`, error);
  }
}

// Create queue with memory driver (persists jobs in memory)
const queue = new Queue({ 
  driver: new MemoryQueueDriver(),
  defaultQueue: "default"
});

// Or use sync driver (executes immediately, no queue)
const syncQueue = new Queue({ driver: new SyncQueueDriver() });

// Dispatch jobs
await queue.dispatch(new SendEmailJob("user@example.com", "Welcome", "Hello!"));

// Dispatch with delay (in seconds)
await queue.later(60, new SendEmailJob("user@example.com", "Reminder", "Don't forget!"));

// Dispatch multiple jobs
await queue.dispatchMany([
  new SendEmailJob("user1@example.com", "Hi", "Message 1"),
  new SendEmailJob("user2@example.com", "Hi", "Message 2"),
]);

// Dispatch to specific queue
await queue.dispatch(new SendEmailJob("user@example.com", "Hi", "Message"), "emails");

// Process jobs manually
await queue.processNext();  // Process one job from default queue
await queue.processNext("emails");  // Process from specific queue

// Start a worker to process jobs automatically
queue.startWorker({ 
  interval: 1000,      // Check every 1 second (default)
  queueName: "default" // Queue to process (default)
});

// Stop the worker
queue.stopWorker();

// Queue management
const size = await queue.size();           // Get queue size
const emailQueueSize = await queue.size("emails"); // Specific queue size
await queue.clear();                       // Clear all jobs
await queue.clear("emails");               // Clear specific queue
```

**Queue System Features:**
- Multiple queue drivers (Memory, Sync)
- Delayed job execution
- Automatic retry with configurable attempts
- Failed job handling
- Multiple queue support
- Worker process for automatic job processing
- Type-safe job definitions

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

Bunavel includes a comprehensive test suite with **369+ tests** covering:
- ✅ Router and routing with parameters
- ✅ Validation with all rules
- ✅ Database query builder
- ✅ Eloquent models and relationships
- ✅ Eager loading for relationships
- ✅ Caching with multiple drivers
- ✅ Event system with listeners
- ✅ Queue system with multiple drivers
- ✅ Middleware system
- ✅ HTTP helpers
- ✅ Database migrations
- ✅ Database seeders

**Test Results:**
```
✓ 338 pass
✓ 0 fail
✓ 691 expect() calls
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
