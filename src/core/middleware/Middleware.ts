export interface Middleware {
  handle(request: Request, next?: () => Promise<Response>): Promise<Request | Response>;
}

export abstract class BaseMiddleware implements Middleware {
  abstract handle(request: Request, next?: () => Promise<Response>): Promise<Request | Response>;
}
