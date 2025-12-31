export class HttpRequest {
  private request: Request;
  private parsedUrl: URL;
  public params: Record<string, string> = {};

  constructor(request: Request, params: Record<string, string> = {}) {
    this.request = request;
    this.parsedUrl = new URL(request.url);
    this.params = params;
  }

  /**
   * Get the request method
   */
  public method(): string {
    return this.request.method;
  }

  /**
   * Get the request URL
   */
  public url(): string {
    return this.request.url;
  }

  /**
   * Get the request path
   */
  public path(): string {
    return this.parsedUrl.pathname;
  }

  /**
   * Get a query parameter
   */
  public query(key: string, defaultValue?: string): string | undefined {
    return this.parsedUrl.searchParams.get(key) ?? defaultValue;
  }

  /**
   * Get all query parameters
   */
  public all(): Record<string, string> {
    const result: Record<string, string> = {};
    this.parsedUrl.searchParams.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Get a route parameter
   */
  public param(key: string, defaultValue?: string): string | undefined {
    return this.params[key] ?? defaultValue;
  }

  /**
   * Get a header value
   */
  public header(key: string): string | null {
    return this.request.headers.get(key);
  }

  /**
   * Check if request has a header
   */
  public hasHeader(key: string): boolean {
    return this.request.headers.has(key);
  }

  /**
   * Get request body as JSON
   */
  public async json<T = any>(): Promise<T> {
    return (await this.request.json()) as T;
  }

  /**
   * Get request body as text
   */
  public async text(): Promise<string> {
    return await this.request.text();
  }

  /**
   * Get request body as FormData
   */
  public async formData(): Promise<any> {
    return await this.request.formData();
  }

  /**
   * Check if request is JSON
   */
  public isJson(): boolean {
    const contentType = this.header("content-type");
    return contentType?.includes("application/json") ?? false;
  }

  /**
   * Check if request wants JSON response
   */
  public wantsJson(): boolean {
    const accept = this.header("accept");
    return accept?.includes("application/json") ?? false;
  }

  /**
   * Get the original Request object
   */
  public raw(): Request {
    return this.request;
  }

  /**
   * Get client IP address
   */
  public ip(): string | null {
    return this.header("x-forwarded-for") || this.header("x-real-ip");
  }

  /**
   * Check if request is from a specific origin
   */
  public isFromOrigin(origin: string): boolean {
    const requestOrigin = this.header("origin");
    return requestOrigin === origin;
  }
}
