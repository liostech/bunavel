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
