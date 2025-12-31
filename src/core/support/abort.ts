import {
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  MethodNotAllowedException,
  ConflictException,
  UnprocessableEntityException,
  TooManyRequestsException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from "../exceptions/HttpException";

/**
 * Throw an HTTP exception with the given status code and message
 */
export function abort(statusCode: number, message?: string): never {
  // Map common status codes to specific exceptions
  switch (statusCode) {
    case 400:
      throw new BadRequestException(message);
    case 401:
      throw new UnauthorizedException(message);
    case 403:
      throw new ForbiddenException(message);
    case 404:
      throw new NotFoundException(message);
    case 405:
      throw new MethodNotAllowedException(message);
    case 409:
      throw new ConflictException(message);
    case 422:
      throw new UnprocessableEntityException(message);
    case 429:
      throw new TooManyRequestsException(message);
    case 500:
      throw new InternalServerErrorException(message);
    case 503:
      throw new ServiceUnavailableException(message);
    default:
      throw new HttpException(statusCode, message || "Error");
  }
}

/**
 * Throw an HTTP exception if the given condition is true
 */
export function abort_if(condition: boolean, statusCode: number, message?: string): void {
  if (condition) {
    abort(statusCode, message);
  }
}

/**
 * Throw an HTTP exception unless the given condition is true
 */
export function abort_unless(condition: boolean, statusCode: number, message?: string): void {
  if (!condition) {
    abort(statusCode, message);
  }
}

/**
 * Throw a 404 Not Found exception
 */
export function abort_404(message?: string): never {
  throw new NotFoundException(message);
}

/**
 * Throw a 403 Forbidden exception
 */
export function abort_403(message?: string): never {
  throw new ForbiddenException(message);
}

/**
 * Throw a 401 Unauthorized exception
 */
export function abort_401(message?: string): never {
  throw new UnauthorizedException(message);
}

/**
 * Throw a 500 Internal Server Error exception
 */
export function abort_500(message?: string): never {
  throw new InternalServerErrorException(message);
}
