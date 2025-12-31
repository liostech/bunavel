export class HttpResponse {
  /**
   * Create a JSON response
   */
  static json(data: any, status: number = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });
  }

  /**
   * Create a text response
   */
  static text(content: string, status: number = 200, headers: Record<string, string> = {}): Response {
    return new Response(content, {
      status,
      headers: {
        "Content-Type": "text/plain",
        ...headers,
      },
    });
  }

  /**
   * Create an HTML response
   */
  static html(content: string, status: number = 200, headers: Record<string, string> = {}): Response {
    return new Response(content, {
      status,
      headers: {
        "Content-Type": "text/html",
        ...headers,
      },
    });
  }

  /**
   * Create a redirect response
   */
  static redirect(url: string, status: number = 302): Response {
    return new Response(null, {
      status,
      headers: {
        Location: url,
      },
    });
  }

  /**
   * Create a 404 Not Found response
   */
  static notFound(message: string = "Not Found"): Response {
    return HttpResponse.json({ error: message }, 404);
  }

  /**
   * Create a 500 Internal Server Error response
   */
  static error(message: string = "Internal Server Error", status: number = 500): Response {
    return HttpResponse.json({ error: message }, status);
  }

  /**
   * Create a 401 Unauthorized response
   */
  static unauthorized(message: string = "Unauthorized"): Response {
    return HttpResponse.json({ error: message }, 401);
  }

  /**
   * Create a 403 Forbidden response
   */
  static forbidden(message: string = "Forbidden"): Response {
    return HttpResponse.json({ error: message }, 403);
  }

  /**
   * Create a 422 Unprocessable Entity response (for validation errors)
   */
  static validationError(errors: Record<string, string[]>): Response {
    return HttpResponse.json({
      message: "Validation failed",
      errors,
    }, 422);
  }

  /**
   * Create a 201 Created response
   */
  static created(data: any, headers: Record<string, string> = {}): Response {
    return HttpResponse.json(data, 201, headers);
  }

  /**
   * Create a 204 No Content response
   */
  static noContent(): Response {
    return new Response(null, { status: 204 });
  }

  /**
   * Create a response with custom status
   */
  static make(content: any, status: number = 200, headers: Record<string, string> = {}): Response {
    const body = typeof content === "string" ? content : JSON.stringify(content);
    const contentType = typeof content === "string" ? "text/plain" : "application/json";

    return new Response(body, {
      status,
      headers: {
        "Content-Type": contentType,
        ...headers,
      },
    });
  }

  /**
   * Create a file download response
   */
  static download(content: string | Uint8Array, filename: string, contentType: string = "application/octet-stream"): Response {
    return new Response(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
}
