import { HttpException } from "./HttpException";
import type { HttpRequest } from "../http/Request";
import { HttpResponse } from "../http/Response";

/**
 * Exception Handler class
 * Handles exceptions and converts them to HTTP responses
 */
export class ExceptionHandler {
  /**
   * Handle an exception and return an HTTP response
   */
  public handle(error: Error, request: HttpRequest): Response {
    // Handle HTTP exceptions
    if (error instanceof HttpException) {
      return this.handleHttpException(error, request);
    }

    // Handle generic errors
    return this.handleGenericError(error, request);
  }

  /**
   * Handle HTTP exceptions
   */
  protected handleHttpException(error: HttpException, request: HttpRequest): Response {
    const statusCode = error.getStatusCode();
    const headers = error.getHeaders();

    // Determine if client wants JSON
    if (this.wantsJson(request)) {
      return this.renderJsonResponse(error, statusCode, headers);
    }

    // Render HTML response
    return this.renderHtmlResponse(error, statusCode, headers);
  }

  /**
   * Handle generic errors (500)
   */
  protected handleGenericError(error: Error, request: HttpRequest): Response {
    const statusCode = 500;
    const message = this.shouldShowDetails() ? error.message : "Internal Server Error";

    // Determine if client wants JSON
    if (this.wantsJson(request)) {
      return HttpResponse.json({
        error: "InternalServerError",
        message: message,
        statusCode: statusCode,
        ...(this.shouldShowDetails() && { stack: error.stack }),
      }, statusCode);
    }

    // Render HTML response
    return this.renderErrorPage(statusCode, message, this.shouldShowDetails() ? error.stack : undefined);
  }

  /**
   * Render JSON response for exception
   */
  protected renderJsonResponse(
    error: HttpException,
    statusCode: number,
    headers: Record<string, string> = {}
  ): Response {
    return HttpResponse.json(error.toJSON(), statusCode, headers);
  }

  /**
   * Render HTML response for exception
   */
  protected renderHtmlResponse(
    error: HttpException,
    statusCode: number,
    headers: Record<string, string> = {}
  ): Response {
    return this.renderErrorPage(statusCode, error.message, undefined, headers);
  }

  /**
   * Render error page
   */
  protected renderErrorPage(
    statusCode: number,
    message: string,
    stack?: string,
    headers: Record<string, string> = {}
  ): Response {
    const title = this.getStatusText(statusCode);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusCode} - ${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .error-code {
      font-size: 72px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 20px;
    }
    .error-title {
      font-size: 24px;
      font-weight: 600;
      color: #333;
      margin-bottom: 10px;
    }
    .error-message {
      font-size: 16px;
      color: #666;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    .stack-trace {
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 20px;
      text-align: left;
      font-family: "Courier New", monospace;
      font-size: 12px;
      color: #333;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin-top: 20px;
    }
    .btn {
      display: inline-block;
      padding: 12px 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      transition: transform 0.2s;
    }
    .btn:hover {
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-code">${statusCode}</div>
    <div class="error-title">${title}</div>
    <div class="error-message">${this.escapeHtml(message)}</div>
    ${stack ? `<div class="stack-trace">${this.escapeHtml(stack)}</div>` : ''}
    <a href="/" class="btn">Go Home</a>
  </div>
</body>
</html>
    `.trim();

    return HttpResponse.html(html, statusCode, headers);
  }

  /**
   * Check if request wants JSON response
   */
  protected wantsJson(request: HttpRequest): boolean {
    const accept = request.header("accept") || "";
    const path = request.path();
    return accept.includes("application/json") || path.startsWith("/api");
  }

  /**
   * Check if should show error details
   */
  protected shouldShowDetails(): boolean {
    // In production, this should be based on environment config
    return process.env.NODE_ENV !== "production";
  }

  /**
   * Get status text for status code
   */
  protected getStatusText(statusCode: number): string {
    const statusTexts: Record<number, string> = {
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      405: "Method Not Allowed",
      409: "Conflict",
      422: "Unprocessable Entity",
      429: "Too Many Requests",
      500: "Internal Server Error",
      503: "Service Unavailable",
    };

    return statusTexts[statusCode] || "Error";
  }

  /**
   * Escape HTML special characters
   */
  protected escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char] || char);
  }
}
