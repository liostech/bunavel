import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Application } from "../../src/core/Application";
import { BaseMiddleware } from "../../src/core/middleware/Middleware";
import { UnauthorizedException } from "../../src/core/exceptions/HttpException";
import { TestClient } from "../helpers/test-helpers";

const PORT = 34782;

class CallLog {
  public calls: string[] = [];
}

class LoggingMiddleware extends BaseMiddleware {
  private log: CallLog;
  private label: string;

  constructor(log: CallLog, label: string) {
    super();
    this.log = log;
    this.label = label;
  }

  async handle(request: Request): Promise<Request | Response> {
    this.log.calls.push(this.label);
    return request;
  }
}

class RejectMiddleware extends BaseMiddleware {
  async handle(): Promise<Request | Response> {
    throw new UnauthorizedException("blocked");
  }
}

describe("Route group middleware integration", () => {
  let app: Application;
  let client: TestClient;
  let log: CallLog;

  beforeAll(async () => {
    log = new CallLog();
    app = new Application();
    app.use(new LoggingMiddleware(log, "global"));

    const router = app.getRouter();
    router.get("/public", () => new Response("public ok"));

    router.group({ prefix: "protected", middleware: [new RejectMiddleware()] }, (router) => {
      router.get("/resource", () => new Response("should not reach"));
    });

    router.group({ prefix: "logged", middleware: [new LoggingMiddleware(log, "group")] }, (router) => {
      router.get("/resource", () => new Response("logged ok")).middleware(new LoggingMiddleware(log, "route"));
    });

    await app.serve(PORT);
    client = new TestClient(`http://localhost:${PORT}`);
  });

  afterAll(async () => {
    await app.stop();
  });

  test("ungrouped route is unaffected by group middleware", async () => {
    const response = await client.get("/public");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("public ok");
  });

  test("group middleware blocks the request before the handler runs", async () => {
    const response = await client.get("/protected/resource");
    expect(response.status).toBe(401);
  });

  test("global middleware still runs for a 404", async () => {
    log.calls = [];
    const response = await client.get("/does-not-exist");
    expect(response.status).toBe(404);
    expect(log.calls).toEqual(["global"]);
  });

  test("group and per-route middleware run in order before the handler", async () => {
    log.calls = [];
    const response = await client.get("/logged/resource");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("logged ok");
    expect(log.calls).toEqual(["global", "group", "route"]);
  });
});
