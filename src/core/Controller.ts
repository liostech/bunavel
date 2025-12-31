export abstract class Controller {
  /**
   * Return a JSON response
   */
  protected json(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Return a text response
   */
  protected text(content: string, status: number = 200): Response {
    return new Response(content, {
      status,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  /**
   * Return an HTML response
   */
  protected html(content: string, status: number = 200): Response {
    return new Response(content, {
      status,
      headers: {
        "Content-Type": "text/html",
      },
    });
  }

  /**
   * Return a redirect response
   */
  protected redirect(url: string, status: number = 302): Response {
    return new Response(null, {
      status,
      headers: {
        Location: url,
      },
    });
  }

  /**
   * Return a 404 response
   */
  protected notFound(message: string = "Not Found"): Response {
    return this.json({ error: message }, 404);
  }

  /**
   * Return a 500 response
   */
  protected error(message: string = "Internal Server Error"): Response {
    return this.json({ error: message }, 500);
  }

  /**
   * Get request body as JSON
   */
  protected async getJsonBody<T = any>(request: Request): Promise<T> {
    return (await request.json()) as T;
  }

  /**
   * Get request body as text
   */
  protected async getTextBody(request: Request): Promise<string> {
    return await request.text();
  }

  /**
   * Get request body as FormData
   */
  protected async getFormData(request: Request): Promise<any> {
    return await request.formData();
  }
}
