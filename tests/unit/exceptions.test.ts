import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  MethodNotAllowedException,
  ConflictException,
  UnprocessableEntityException,
  ValidationException,
  TooManyRequestsException,
  InternalServerErrorException,
  ServiceUnavailableException,
  ModelNotFoundException,
} from "../../src/core/exceptions/HttpException";
import { ExceptionHandler } from "../../src/core/exceptions/ExceptionHandler";
import {
  abort,
  abort_if,
  abort_unless,
  abort_404,
  abort_403,
  abort_401,
  abort_500,
} from "../../src/core/support/abort";
import { HttpRequest } from "../../src/core/http/Request";
import { Application } from "../../src/core/Application";

describe("HTTP Exceptions", () => {
  test("HttpException creates exception with status code and message", () => {
    const exception = new HttpException(418, "I'm a teapot");
    
    expect(exception.statusCode).toBe(418);
    expect(exception.message).toBe("I'm a teapot");
    expect(exception.name).toBe("HttpException");
  });

  test("HttpException can include headers", () => {
    const headers = { "X-Custom": "value" };
    const exception = new HttpException(500, "Error", headers);
    
    expect(exception.headers).toEqual(headers);
  });

  test("HttpException toJSON returns proper structure", () => {
    const exception = new HttpException(500, "Server error");
    const json = exception.toJSON();
    
    expect(json).toEqual({
      error: "HttpException",
      message: "Server error",
      statusCode: 500,
    });
  });

  test("BadRequestException has 400 status", () => {
    const exception = new BadRequestException("Invalid input");
    
    expect(exception.statusCode).toBe(400);
    expect(exception.message).toBe("Invalid input");
    expect(exception.name).toBe("BadRequestException");
  });

  test("UnauthorizedException has 401 status", () => {
    const exception = new UnauthorizedException("Not authenticated");
    
    expect(exception.statusCode).toBe(401);
    expect(exception.message).toBe("Not authenticated");
  });

  test("ForbiddenException has 403 status", () => {
    const exception = new ForbiddenException("Access denied");
    
    expect(exception.statusCode).toBe(403);
    expect(exception.message).toBe("Access denied");
  });

  test("NotFoundException has 404 status", () => {
    const exception = new NotFoundException("Resource not found");
    
    expect(exception.statusCode).toBe(404);
    expect(exception.message).toBe("Resource not found");
  });

  test("MethodNotAllowedException has 405 status", () => {
    const exception = new MethodNotAllowedException("Method not allowed");
    
    expect(exception.statusCode).toBe(405);
    expect(exception.message).toBe("Method not allowed");
  });

  test("ConflictException has 409 status", () => {
    const exception = new ConflictException("Resource conflict");
    
    expect(exception.statusCode).toBe(409);
    expect(exception.message).toBe("Resource conflict");
  });

  test("UnprocessableEntityException has 422 status", () => {
    const exception = new UnprocessableEntityException("Invalid data");
    
    expect(exception.statusCode).toBe(422);
    expect(exception.message).toBe("Invalid data");
  });

  test("TooManyRequestsException has 429 status", () => {
    const exception = new TooManyRequestsException("Rate limit exceeded");
    
    expect(exception.statusCode).toBe(429);
    expect(exception.message).toBe("Rate limit exceeded");
  });

  test("InternalServerErrorException has 500 status", () => {
    const exception = new InternalServerErrorException("Server error");
    
    expect(exception.statusCode).toBe(500);
    expect(exception.message).toBe("Server error");
  });

  test("ServiceUnavailableException has 503 status", () => {
    const exception = new ServiceUnavailableException("Service down");
    
    expect(exception.statusCode).toBe(503);
    expect(exception.message).toBe("Service down");
  });

  test("ValidationException includes errors", () => {
    const errors = {
      email: ["Email is required"],
      password: ["Password must be at least 8 characters"],
    };
    const exception = new ValidationException(errors, "Validation failed");
    
    expect(exception.statusCode).toBe(422);
    expect(exception.errors).toEqual(errors);
    expect(exception.message).toBe("Validation failed");
  });

  test("ValidationException toJSON includes errors", () => {
    const errors = { email: ["Invalid email"] };
    const exception = new ValidationException(errors, "Validation failed");
    const json = exception.toJSON();
    
    expect(json).toEqual({
      error: "ValidationException",
      message: "Validation failed",
      statusCode: 422,
      errors,
    });
  });

  test("ModelNotFoundException includes model name and identifier", () => {
    const exception = new ModelNotFoundException("User", 123);
    
    expect(exception.statusCode).toBe(404);
    expect(exception.message).toBe("User not found with identifier: 123");
  });

  test("ModelNotFoundException works without identifier", () => {
    const exception = new ModelNotFoundException("Post");
    
    expect(exception.statusCode).toBe(404);
    expect(exception.message).toBe("Post not found");
  });
});

describe("ExceptionHandler", () => {
  let handler: ExceptionHandler;
  let originalEnv: string | undefined;

  beforeEach(() => {
    handler = new ExceptionHandler();
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test("handles HttpException and returns JSON for API routes", async () => {
    const exception = new NotFoundException("User not found");
    const request = new Request("http://localhost/api/users/1");
    const httpRequest = new HttpRequest(request);

    const response = await handler.handle(exception, httpRequest);

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("application/json");

    const body = await response.json();
    expect(body).toEqual({
      error: "NotFoundException",
      message: "User not found",
      statusCode: 404,
    });
  });

  test("handles HttpException and returns JSON for Accept: application/json", async () => {
    const exception = new BadRequestException("Invalid data");
    const request = new Request("http://localhost/users", {
      headers: { Accept: "application/json" },
    });
    const httpRequest = new HttpRequest(request);

    const response = await handler.handle(exception, httpRequest);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: "BadRequestException",
      message: "Invalid data",
      statusCode: 400,
    });
  });

  test("handles HttpException and returns HTML for non-API routes", async () => {
    const exception = new ForbiddenException("Access denied");
    const request = new Request("http://localhost/admin");
    const httpRequest = new HttpRequest(request);

    const response = await handler.handle(exception, httpRequest);

    expect(response.status).toBe(403);
    expect(response.headers.get("Content-Type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("403");
    expect(html).toContain("Forbidden");
    expect(html).toContain("Access denied");
  });

  test("includes stack trace in HTML for development mode", async () => {
    process.env.NODE_ENV = "development";
    
    const error = new Error("Server error");
    const request = new Request("http://localhost/error");
    const httpRequest = new HttpRequest(request);

    const response = await handler.handle(error, httpRequest);
    const html = await response.text();

    // Stack trace should be present (even if HTML-escaped)
    expect(html).toContain("stack-trace");
    expect(html).toContain("Server error");
  });

  test("hides stack trace in HTML for production mode", async () => {
    process.env.NODE_ENV = "production";
    
    const error = new Error("Server error");
    const request = new Request("http://localhost/error");
    const httpRequest = new HttpRequest(request);

    const response = await handler.handle(error, httpRequest);
    const html = await response.text();

    expect(html).not.toContain("Error:");
    expect(html).toContain("Internal Server Error");
  });

  test("handles ValidationException with errors in JSON", async () => {
    const errors = {
      email: ["Email is required", "Email must be valid"],
      password: ["Password is required"],
    };
    const exception = new ValidationException(errors, "Validation failed");
    const request = new Request("http://localhost/api/register");
    const httpRequest = new HttpRequest(request);

    const response = await handler.handle(exception, httpRequest);
    const body = await response.json();

    expect(body).toEqual({
      error: "ValidationException",
      message: "Validation failed",
      statusCode: 422,
      errors,
    });
  });

  test("handles generic Error as 500 Internal Server Error", async () => {
    const error = new Error("Something went wrong");
    const request = new Request("http://localhost/api/test");
    const httpRequest = new HttpRequest(request);

    const response = await handler.handle(error, httpRequest);

    expect(response.status).toBe(500);
    const body = await response.json() as any;
    expect(body.error).toBe("InternalServerError");
    expect(body.message).toBe("Something went wrong");
    expect(body.statusCode).toBe(500);
  });

  test("applies custom headers from exception", async () => {
    const headers = { "X-Custom-Header": "test-value" };
    const exception = new HttpException(429, "Too many requests", headers);
    const request = new Request("http://localhost/api/test");
    const httpRequest = new HttpRequest(request);

    const response = await handler.handle(exception, httpRequest);

    expect(response.headers.get("X-Custom-Header")).toBe("test-value");
  });

  test("handles ModelNotFoundException", async () => {
    const exception = new ModelNotFoundException("User", 999);
    const request = new Request("http://localhost/api/users/999");
    const httpRequest = new HttpRequest(request);

    const response = await handler.handle(exception, httpRequest);
    const body = await response.json();

    expect(body).toEqual({
      error: "ModelNotFoundException",
      message: "User not found with identifier: 999",
      statusCode: 404,
    });
  });
});

describe("abort helpers", () => {
  test("abort throws HttpException with status and message", () => {
    expect(() => abort(404, "Not found")).toThrow(NotFoundException);
    
    try {
      abort(404, "Resource not found");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as HttpException).statusCode).toBe(404);
      expect((error as HttpException).message).toBe("Resource not found");
    }
  });

  test("abort throws correct exception class based on status code", () => {
    expect(() => abort(400, "Bad request")).toThrow(BadRequestException);
    expect(() => abort(401, "Unauthorized")).toThrow(UnauthorizedException);
    expect(() => abort(403, "Forbidden")).toThrow(ForbiddenException);
    expect(() => abort(404, "Not found")).toThrow(NotFoundException);
    expect(() => abort(405, "Method not allowed")).toThrow(MethodNotAllowedException);
    expect(() => abort(409, "Conflict")).toThrow(ConflictException);
    expect(() => abort(422, "Unprocessable")).toThrow(UnprocessableEntityException);
    expect(() => abort(429, "Too many requests")).toThrow(TooManyRequestsException);
    expect(() => abort(500, "Internal error")).toThrow(InternalServerErrorException);
    expect(() => abort(503, "Service unavailable")).toThrow(ServiceUnavailableException);
  });

  test("abort_if throws when condition is true", () => {
    const user = null;
    
    expect(() => abort_if(!user, 404, "User not found")).toThrow(NotFoundException);
  });

  test("abort_if does not throw when condition is false", () => {
    const user = { id: 1, name: "John" };
    
    expect(() => abort_if(!user, 404, "User not found")).not.toThrow();
  });

  test("abort_unless throws when condition is false", () => {
    const isAdmin = false;
    
    expect(() => abort_unless(isAdmin, 403, "Not authorized")).toThrow(ForbiddenException);
  });

  test("abort_unless does not throw when condition is true", () => {
    const isAdmin = true;
    
    expect(() => abort_unless(isAdmin, 403, "Not authorized")).not.toThrow();
  });

  test("abort_404 throws NotFoundException", () => {
    expect(() => abort_404("Page not found")).toThrow(NotFoundException);
    
    try {
      abort_404("Resource missing");
    } catch (error) {
      expect((error as HttpException).statusCode).toBe(404);
      expect((error as HttpException).message).toBe("Resource missing");
    }
  });

  test("abort_404 uses default message when none provided", () => {
    try {
      abort_404();
    } catch (error) {
      expect((error as HttpException).message).toBe("Not Found");
    }
  });

  test("abort_403 throws ForbiddenException", () => {
    expect(() => abort_403("Access denied")).toThrow(ForbiddenException);
    
    try {
      abort_403("Insufficient permissions");
    } catch (error) {
      expect((error as HttpException).statusCode).toBe(403);
      expect((error as HttpException).message).toBe("Insufficient permissions");
    }
  });

  test("abort_403 uses default message when none provided", () => {
    try {
      abort_403();
    } catch (error) {
      expect((error as HttpException).message).toBe("Forbidden");
    }
  });

  test("abort_401 throws UnauthorizedException", () => {
    expect(() => abort_401("Not authenticated")).toThrow(UnauthorizedException);
    
    try {
      abort_401("Please login");
    } catch (error) {
      expect((error as HttpException).statusCode).toBe(401);
      expect((error as HttpException).message).toBe("Please login");
    }
  });

  test("abort_401 uses default message when none provided", () => {
    try {
      abort_401();
    } catch (error) {
      expect((error as HttpException).message).toBe("Unauthorized");
    }
  });

  test("abort_500 throws InternalServerErrorException", () => {
    expect(() => abort_500("Server error")).toThrow(InternalServerErrorException);
    
    try {
      abort_500("Database connection failed");
    } catch (error) {
      expect((error as HttpException).statusCode).toBe(500);
      expect((error as HttpException).message).toBe("Database connection failed");
    }
  });

  test("abort_500 uses default message when none provided", () => {
    try {
      abort_500();
    } catch (error) {
      expect((error as HttpException).message).toBe("Internal Server Error");
    }
  });
});

describe("Integration with Router", () => {
  test("ExceptionHandler handles routing exceptions", async () => {
    const handler = new ExceptionHandler();
    const exception = new NotFoundException("Route not found: GET /nonexistent");
    const request = new Request("http://localhost/api/nonexistent");
    const httpRequest = new HttpRequest(request);

    const response = await handler.handle(exception, httpRequest);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({
      error: "NotFoundException",
      message: "Route not found: GET /nonexistent",
      statusCode: 404,
    });
  });

  test("ExceptionHandler handles validation errors from routes", async () => {
    const handler = new ExceptionHandler();
    const errors = {
      email: ["Email is required"],
      password: ["Password must be at least 8 characters"],
    };
    const exception = new ValidationException(errors, "Validation failed");
    const request = new Request("http://localhost/api/register", {
      method: "POST",
    });
    const httpRequest = new HttpRequest(request);

    const response = await handler.handle(exception, httpRequest);

    expect(response.status).toBe(422);
    const body = await response.json() as any;
    expect(body.errors).toEqual(errors);
  });

  test("abort helpers can be used in route handlers", () => {
    // Simulate a route handler throwing an abort
    const routeHandler = () => {
      abort_403("You shall not pass");
    };

    expect(() => routeHandler()).toThrow(ForbiddenException);
    
    try {
      routeHandler();
    } catch (error) {
      expect((error as HttpException).statusCode).toBe(403);
      expect((error as HttpException).message).toBe("You shall not pass");
    }
  });
});

