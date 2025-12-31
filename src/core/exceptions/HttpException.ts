/**
 * Base HTTP Exception class
 */
export class HttpException extends Error {
  public statusCode: number;
  public headers: Record<string, string>;

  constructor(statusCode: number, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.headers = headers;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get status code
   */
  public getStatusCode(): number {
    return this.statusCode;
  }

  /**
   * Get headers
   */
  public getHeaders(): Record<string, string> {
    return this.headers;
  }

  /**
   * Convert to JSON
   */
  public toJSON(): Record<string, any> {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestException extends HttpException {
  constructor(message: string = "Bad Request") {
    super(400, message);
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedException extends HttpException {
  constructor(message: string = "Unauthorized") {
    super(401, message);
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenException extends HttpException {
  constructor(message: string = "Forbidden") {
    super(403, message);
  }
}

/**
 * 404 Not Found
 */
export class NotFoundException extends HttpException {
  constructor(message: string = "Not Found") {
    super(404, message);
  }
}

/**
 * 405 Method Not Allowed
 */
export class MethodNotAllowedException extends HttpException {
  constructor(message: string = "Method Not Allowed") {
    super(405, message);
  }
}

/**
 * 409 Conflict
 */
export class ConflictException extends HttpException {
  constructor(message: string = "Conflict") {
    super(409, message);
  }
}

/**
 * 422 Unprocessable Entity
 */
export class UnprocessableEntityException extends HttpException {
  constructor(message: string = "Unprocessable Entity") {
    super(422, message);
  }
}

/**
 * 429 Too Many Requests
 */
export class TooManyRequestsException extends HttpException {
  constructor(message: string = "Too Many Requests") {
    super(429, message);
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerErrorException extends HttpException {
  constructor(message: string = "Internal Server Error") {
    super(500, message);
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableException extends HttpException {
  constructor(message: string = "Service Unavailable") {
    super(503, message);
  }
}

/**
 * Validation Exception
 */
export class ValidationException extends HttpException {
  public errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]>, message: string = "Validation failed") {
    super(422, message);
    this.errors = errors;
  }

  /**
   * Get validation errors
   */
  public getErrors(): Record<string, string[]> {
    return this.errors;
  }

  /**
   * Convert to JSON with errors
   */
  public override toJSON(): Record<string, any> {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errors: this.errors,
    };
  }
}

/**
 * Model Not Found Exception
 */
export class ModelNotFoundException extends NotFoundException {
  constructor(model: string, identifier?: any) {
    const message = identifier 
      ? `${model} not found with identifier: ${identifier}`
      : `${model} not found`;
    super(message);
  }
}
