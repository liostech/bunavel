import { BaseMiddleware } from "../middleware/Middleware";
import { UnauthorizedException } from "../exceptions/HttpException";
import { Auth } from "./Auth";

/**
 * Rejects guest requests with a 401. Opt-in via app.use() — since this
 * framework only supports global middleware, applying this middleware
 * protects every route, including auth endpoints like /auth/login. Prefer
 * calling Auth.check()/Auth.user() imperatively inside a controller method
 * to protect specific routes.
 */
export class AuthMiddleware extends BaseMiddleware {
  async handle(request: Request): Promise<Request | Response> {
    if (Auth.guest(request)) {
      throw new UnauthorizedException("Unauthenticated.");
    }
    return request;
  }
}
