import { BaseMiddleware } from "../middleware/Middleware";

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export class CorsMiddleware extends BaseMiddleware {
  private options: CorsOptions;

  constructor(options: CorsOptions = {}) {
    super();
    this.options = {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      exposedHeaders: [],
      credentials: false,
      maxAge: 86400, // 24 hours
      ...options,
    };
  }

  async handle(request: Request): Promise<Request | Response> {
    const origin = request.headers.get("origin") || "*";
    const method = request.method;

    // Handle preflight request
    if (method === "OPTIONS") {
      return this.handlePreflight(origin);
    }

    // Check if origin is allowed
    if (!this.isOriginAllowed(origin)) {
      return new Response("CORS: Origin not allowed", { status: 403 });
    }

    // For non-preflight requests, we need to attach CORS headers to the response
    // Since middleware can't modify the final response, we'll pass the request through
    // and let the application handle adding headers via a response wrapper
    return request;
  }

  private handlePreflight(origin: string): Response {
    const headers = new Headers();

    // Set Access-Control-Allow-Origin
    if (this.isOriginAllowed(origin)) {
      headers.set("Access-Control-Allow-Origin", this.getAllowedOrigin(origin));
    }

    // Set Access-Control-Allow-Methods
    if (this.options.methods) {
      headers.set("Access-Control-Allow-Methods", this.options.methods.join(", "));
    }

    // Set Access-Control-Allow-Headers
    if (this.options.allowedHeaders) {
      headers.set("Access-Control-Allow-Headers", this.options.allowedHeaders.join(", "));
    }

    // Set Access-Control-Expose-Headers
    if (this.options.exposedHeaders && this.options.exposedHeaders.length > 0) {
      headers.set("Access-Control-Expose-Headers", this.options.exposedHeaders.join(", "));
    }

    // Set Access-Control-Allow-Credentials
    if (this.options.credentials) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }

    // Set Access-Control-Max-Age
    if (this.options.maxAge) {
      headers.set("Access-Control-Max-Age", this.options.maxAge.toString());
    }

    return new Response(null, { status: 204, headers });
  }

  private isOriginAllowed(origin: string): boolean {
    const allowedOrigin = this.options.origin;

    if (!allowedOrigin) {
      return false;
    }

    if (allowedOrigin === "*") {
      return true;
    }

    if (typeof allowedOrigin === "string") {
      return origin === allowedOrigin;
    }

    if (Array.isArray(allowedOrigin)) {
      return allowedOrigin.includes(origin);
    }

    if (typeof allowedOrigin === "function") {
      return allowedOrigin(origin);
    }

    return false;
  }

  private getAllowedOrigin(origin: string): string {
    const allowedOrigin = this.options.origin;

    if (allowedOrigin === "*") {
      return "*";
    }

    if (typeof allowedOrigin === "string") {
      return allowedOrigin;
    }

    if (Array.isArray(allowedOrigin)) {
      return allowedOrigin.includes(origin) ? origin : allowedOrigin[0] || "*";
    }

    if (typeof allowedOrigin === "function") {
      return allowedOrigin(origin) ? origin : "*";
    }

    return "*";
  }
}
