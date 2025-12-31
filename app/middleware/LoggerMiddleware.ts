import { BaseMiddleware } from "../../src/core/middleware/Middleware";

export class LoggerMiddleware extends BaseMiddleware {
  async handle(request: Request): Promise<Request> {
    const url = new URL(request.url);
    const method = request.method;
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] ${method} ${url.pathname}`);

    return request;
  }
}
