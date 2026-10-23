import type { RequestHandler } from 'express';
import type { UserRole } from '../types/domain';
import { forbidden, unauthorized } from '../utils/errors';

/**
 * Route-level role gate from the RBAC matrix (Security-policy.md, section 4).
 * Always mounted after `authenticate`, which is what populates req.user.
 */
export function requireRole(...roles: UserRole[]): RequestHandler {
  const allowed = new Set(roles);

  return (req, _res, next) => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!allowed.has(req.user.role)) {
      next(forbidden());
      return;
    }
    next();
  };
}
