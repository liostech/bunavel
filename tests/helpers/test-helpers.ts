import { expect } from "bun:test";

/**
 * Test helper for making HTTP requests to the application
 */
export class TestClient {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:3000") {
    this.baseUrl = baseUrl;
  }

  async get(path: string, headers: Record<string, string> = {}): Promise<Response> {
    return await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers,
    });
  }

  async post(path: string, data: any, headers: Record<string, string> = {}): Promise<Response> {
    return await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(data),
    });
  }

  async put(path: string, data: any, headers: Record<string, string> = {}): Promise<Response> {
    return await fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(data),
    });
  }

  async patch(path: string, data: any, headers: Record<string, string> = {}): Promise<Response> {
    return await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(data),
    });
  }

  async delete(path: string, headers: Record<string, string> = {}): Promise<Response> {
    return await fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers,
    });
  }
}

/**
 * Create a mock Request object for testing
 */
export function createMockRequest(
  url: string,
  method: string = "GET",
  body?: any,
  headers: Record<string, string> = {}
): Request {
  const requestInit: RequestInit = {
    method,
    headers: new Headers(headers),
  };

  if (body) {
    requestInit.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!headers["Content-Type"]) {
      (requestInit.headers as Headers).set("Content-Type", "application/json");
    }
  }

  return new Request(url, requestInit);
}

/**
 * Expect response to be JSON
 */
export async function expectJson(response: Response, expectedData?: any): Promise<any> {
  expect(response.headers.get("Content-Type")).toContain("application/json");
  const data = await response.json();
  if (expectedData) {
    expect(data).toEqual(expectedData);
  }
  return data;
}

/**
 * Expect response to have status code
 */
export function expectStatus(response: Response, status: number): void {
  expect(response.status).toBe(status);
}

/**
 * Create a temporary in-memory database for testing
 */
export function createTestDatabase(): any {
  const { DatabaseConnection } = require("../src/core/database/Connection");
  const connection = new DatabaseConnection({
    driver: "sqlite",
    connection: { filename: ":memory:" },
  });
  connection.connect();
  return connection;
}

/**
 * Setup a test database with users table
 */
export function setupTestUsersTable(connection: any): void {
  connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )
  `);
}

/**
 * Clean up test database
 */
export function cleanupTestDatabase(connection: any, tables: string[] = []): void {
  for (const table of tables) {
    try {
      connection.execute(`DROP TABLE IF EXISTS ${table}`);
    } catch (error) {
      // Ignore errors
    }
  }
}
