# Testing Guide for Bunavel

Bunavel uses Bun's built-in test runner for fast, zero-config testing.

## Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage

# Run specific test file
bun test tests/unit/router.test.ts
```

## Test Structure

```
tests/
├── unit/              # Unit tests
│   ├── router.test.ts
│   ├── validator.test.ts
│   └── query-builder.test.ts
├── integration/       # Integration tests
└── helpers/           # Test utilities
    └── test-helpers.ts
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, test, expect } from "bun:test";

describe("Feature Name", () => {
  test("should do something", () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

### Setup and Teardown

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";

describe("DatabaseTests", () => {
  let connection;

  beforeEach(() => {
    connection = createConnection();
    connection.connect();
  });

  afterEach(() => {
    connection.close();
  });

  test("should query database", () => {
    const result = connection.query("SELECT 1");
    expect(result).toBeDefined();
  });
});
```

## Test Helpers

### Creating Mock Requests

```typescript
import { createMockRequest } from "./tests/helpers/test-helpers";

const request = createMockRequest("http://localhost/users", "GET");
const postRequest = createMockRequest(
  "http://localhost/users",
  "POST",
  { name: "John" },
  { "Content-Type": "application/json" }
);
```

### Testing Responses

```typescript
import { expectJson, expectStatus } from "./tests/helpers/test-helpers";

const response = await handler(request);
expectStatus(response, 200);
const data = await expectJson(response, { success: true });
```

### Database Testing

```typescript
import {
  createTestDatabase,
  setupTestUsersTable,
  cleanupTestDatabase,
} from "./tests/helpers/test-helpers";

const connection = createTestDatabase();
setupTestUsersTable(connection);

// Run your tests

cleanupTestDatabase(connection, ["users"]);
```

## Testing Examples

### Testing Routes

```typescript
import { describe, test, expect } from "bun:test";
import { Router } from "../src/core/routing/Router";

describe("Router", () => {
  test("should match route with parameters", () => {
    const router = new Router();
    router.get("/users/{id}", () => new Response("User"));

    const match = router.match("GET", "/users/123");

    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ id: "123" });
  });
});
```

### Testing Validation

```typescript
import { describe, test, expect } from "bun:test";
import { validate } from "../src/core/validation/Validator";

describe("Validator", () => {
  test("should validate email", async () => {
    const validator = validate(
      { email: "test@example.com" },
      { email: ["required", "email"] }
    );

    const isValid = await validator.validate();

    expect(isValid).toBe(true);
    expect(validator.getErrors()).toEqual({});
  });

  test("should fail invalid email", async () => {
    const validator = validate(
      { email: "invalid" },
      { email: ["required", "email"] }
    );

    const isValid = await validator.validate();

    expect(isValid).toBe(false);
    expect(validator.getErrors().email).toBeDefined();
  });
});
```

### Testing Database Queries

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { DatabaseConnection } from "../src/core/database/Connection";
import { QueryBuilder } from "../src/core/database/QueryBuilder";

describe("QueryBuilder", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = new DatabaseConnection({
      driver: "sqlite",
      connection: { filename: ":memory:" },
    });
    connection.connect();

    connection.execute(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL
      )
    `);

    connection.execute(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Alice", "alice@example.com"]
    );
  });

  afterEach(() => {
    connection.close();
  });

  test("should get all records", () => {
    const users = new QueryBuilder(connection)
      .table("users")
      .get();

    expect(users.length).toBe(1);
    expect(users[0]?.name).toBe("Alice");
  });

  test("should filter with WHERE", () => {
    const users = new QueryBuilder(connection)
      .table("users")
      .where("name", "Alice")
      .get();

    expect(users.length).toBe(1);
  });
});
```

### Testing Controllers

```typescript
import { describe, test, expect } from "bun:test";
import { createMockRequest, expectJson } from "../tests/helpers/test-helpers";
import { WelcomeController } from "../app/controllers/WelcomeController";

describe("WelcomeController", () => {
  test("should return welcome message", async () => {
    const controller = new WelcomeController();
    const request = createMockRequest("http://localhost/");

    const response = await controller.index(request);

    expectStatus(response, 200);
    const data = await expectJson(response);
    expect(data.message).toBe("Welcome to Bunavel!");
  });

  test("should greet user by name", async () => {
    const controller = new WelcomeController();
    const request = createMockRequest("http://localhost/hello/John");

    const response = await controller.show(request, { name: "John" });

    const data = await expectJson(response);
    expect(data.message).toBe("Hello, John!");
  });
});
```

### Testing Middleware

```typescript
import { describe, test, expect } from "bun:test";
import { createMockRequest } from "../tests/helpers/test-helpers";
import { LoggerMiddleware } from "../app/middleware/LoggerMiddleware";

describe("LoggerMiddleware", () => {
  test("should pass request through", async () => {
    const middleware = new LoggerMiddleware();
    const request = createMockRequest("http://localhost/test", "GET");

    const result = await middleware.handle(request);

    expect(result).toBeInstanceOf(Request);
    expect(result.url).toBe("http://localhost/test");
  });
});
```

## Best Practices

### 1. Test Isolation

Each test should be independent and not rely on other tests:

```typescript
describe("Users", () => {
  beforeEach(() => {
    // Set up fresh state for each test
  });

  afterEach(() => {
    // Clean up after each test
  });
});
```

### 2. Descriptive Test Names

```typescript
// Good
test("should return 404 when user not found", () => {});

// Bad
test("test user", () => {});
```

### 3. Arrange-Act-Assert Pattern

```typescript
test("should create user", () => {
  // Arrange
  const userData = { name: "John", email: "john@example.com" };

  // Act
  const user = User.create(userData);

  // Assert
  expect(user.name).toBe("John");
  expect(user.email).toBe("john@example.com");
});
```

### 4. Use In-Memory Databases

For database tests, always use in-memory SQLite databases:

```typescript
const connection = new DatabaseConnection({
  driver: "sqlite",
  connection: { filename: ":memory:" },
});
```

### 5. Test Error Cases

Don't just test the happy path:

```typescript
test("should handle invalid input", () => {
  expect(() => {
    myFunction(invalidInput);
  }).toThrow();
});
```

## Assertions

Bun's test runner provides many assertion methods:

```typescript
// Equality
expect(value).toBe(expected);
expect(value).toEqual(expected);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(5);
expect(value).toBeLessThan(10);
expect(value).toBeGreaterThanOrEqual(5);
expect(value).toBeLessThanOrEqual(10);

// Strings
expect(string).toContain("substring");
expect(string).toMatch(/pattern/);

// Arrays
expect(array).toContain(item);
expect(array).toHaveLength(3);

// Objects
expect(obj).toHaveProperty("key");
expect(obj).toMatchObject({ key: "value" });

// Exceptions
expect(() => fn()).toThrow();
expect(() => fn()).toThrow("error message");

// Negation
expect(value).not.toBe(unexpected);
```

## Coverage

To see test coverage:

```bash
bun test --coverage
```

This will show:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

## Debugging Tests

### Using console.log

```typescript
test("debug test", () => {
  const value = getValue();
  console.log("Value:", value);
  expect(value).toBe(expected);
});
```

### Using Bun's debugger

```bash
bun --inspect test
```

## Continuous Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
```

## Test Coverage Goals

Aim for:
- **80%+ overall coverage**
- **100% coverage for critical paths** (auth, payments, etc.)
- **All public APIs tested**
- **Edge cases covered**

## Example Test Suite

See the `tests/` directory for complete examples:

- **tests/unit/router.test.ts** - Router testing with parameters
- **tests/unit/validator.test.ts** - Comprehensive validation tests
- **tests/unit/query-builder.test.ts** - Database query testing
- **tests/helpers/test-helpers.ts** - Reusable test utilities

## Running Specific Tests

```bash
# Run tests matching a pattern
bun test --test-name-pattern "should validate email"

# Run tests in a specific file
bun test tests/unit/validator.test.ts

# Run tests in watch mode
bun test --watch
```

## Tips

1. **Keep tests fast** - Use in-memory databases, mock external services
2. **Test behavior, not implementation** - Focus on what the code does, not how
3. **Write tests first (TDD)** - Red → Green → Refactor
4. **Keep tests simple** - One assertion per test when possible
5. **Use meaningful test data** - `"John Doe"` is better than `"test"`

Happy Testing! 🧪
