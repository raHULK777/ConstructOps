export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TENANT_SCOPE_MISMATCH'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FEATURE_DISABLED'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

/**
 * Every deliberate failure travels as an AppError. The global handler turns it
 * into the platform error envelope; anything else becomes an opaque 500 so
 * internal details never reach a client (Security-policy.md, section 5).
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly expose: boolean;

  constructor(statusCode: number, message: string, code: ErrorCode, expose = statusCode < 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.expose = expose;
    Error.captureStackTrace?.(this, AppError);
  }
}

export function badRequest(message: string, code: ErrorCode = 'VALIDATION_ERROR'): AppError {
  return new AppError(400, message, code);
}

export function unauthorized(message = 'Access token missing or expired.'): AppError {
  return new AppError(401, message, 'UNAUTHORIZED');
}

export function forbidden(
  message = 'You do not have permission to perform this action.',
  code: ErrorCode = 'FORBIDDEN',
): AppError {
  return new AppError(403, message, code);
}

export function tenantScopeMismatch(): AppError {
  return new AppError(
    403,
    'Access token scope does not match current tenant domain context.',
    'TENANT_SCOPE_MISMATCH',
  );
}

export function notFound(message = 'Requested record resource not found.'): AppError {
  return new AppError(404, message, 'NOT_FOUND');
}

export function conflict(message: string): AppError {
  return new AppError(409, message, 'CONFLICT');
}

export function featureDisabled(feature: string): AppError {
  return new AppError(
    403,
    `The premium module '${feature}' is disabled for this tenant.`,
    'FEATURE_DISABLED',
  );
}

export function unsupportedMediaType(
  message = 'Content-Type must be application/json.',
): AppError {
  return new AppError(415, message, 'UNSUPPORTED_MEDIA_TYPE');
}

export function serviceUnavailable(message = 'Service temporarily unavailable.'): AppError {
  return new AppError(503, message, 'SERVICE_UNAVAILABLE');
}

export function internalError(message = 'Internal server error.'): AppError {
  return new AppError(500, message, 'INTERNAL_ERROR', false);
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
