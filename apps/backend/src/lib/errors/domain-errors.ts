import { HTTP_STATUS, ERROR_CODES } from '@dotor/shared';

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST, details);
  }
}

export class AuthError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.AUTH_ERROR, HTTP_STATUS.UNAUTHORIZED, details);
  }
}

export class PermissionError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.PERMISSION_ERROR, HTTP_STATUS.FORBIDDEN, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND, details);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.CONFLICT, HTTP_STATUS.CONFLICT, details);
  }
}

export class RateLimitError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.RATE_LIMIT, HTTP_STATUS.TOO_MANY_REQUESTS, details);
  }
}
