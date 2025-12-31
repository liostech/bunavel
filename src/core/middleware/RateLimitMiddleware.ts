import { BaseMiddleware } from "../middleware/Middleware";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimitMiddleware extends BaseMiddleware {
  private store: Map<string, RateLimitEntry> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 60, windowMs: number = 60000) {
    super();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  async handle(request: Request): Promise<Request | Response> {
    const key = this.getKey(request);
    const now = Date.now();
    
    let entry = this.store.get(key);

    // Create or reset entry if expired
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + this.windowMs,
      };
      this.store.set(key, entry);
    }

    // Increment request count
    entry.count++;

    // Check if rate limit exceeded
    if (entry.count > this.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return new Response(
        JSON.stringify({
          error: "Too many requests",
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": this.maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": entry.resetAt.toString(),
          },
        }
      );
    }

    // Allow request through
    return request;
  }

  /**
   * Get rate limit key from request (IP address)
   */
  private getKey(request: Request): string {
    // Try to get IP from headers
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() || "unknown";
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
      return realIp;
    }

    // Fallback to URL-based key
    return new URL(request.url).hostname;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all rate limit entries
   */
  public clear(): void {
    this.store.clear();
  }

  /**
   * Get current rate limit for a key
   */
  public getLimit(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }
}
