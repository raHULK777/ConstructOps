import type { Request } from 'express';
import type { AuthUser, TenantRecord } from '../types/domain';
import { AppError } from './errors';

/**
 * Accessors that make the middleware contract explicit. Reaching a controller
 * without tenant/user context is a programming error, not a client error, so it
 * is reported as an opaque 500 rather than a 401.
 */
export function requireTenant(req: Request): TenantRecord {
  if (!req.tenant) {
    throw new AppError(500, 'Tenant context is missing from the request.', 'INTERNAL_ERROR', false);
  }
  return req.tenant;
}

export function requireUser(req: Request): AuthUser {
  if (!req.user) {
    throw new AppError(500, 'User context is missing from the request.', 'INTERNAL_ERROR', false);
  }
  return req.user;
}
