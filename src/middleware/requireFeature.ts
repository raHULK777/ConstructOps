import type { RequestHandler } from 'express';
import { featureDisabled } from '../utils/errors';

export type FeatureKey = 'enable_estimator' | 'enable_client_portal' | 'enable_change_orders';

/**
 * Premium module gate. The flag is read from the tenant record resolved for the
 * current host, never from the request body or token.
 */
export function requireFeature(feature: FeatureKey): RequestHandler {
  return (req, _res, next) => {
    if (!req.tenant) {
      next(featureDisabled(feature));
      return;
    }
    if (!req.tenant[feature]) {
      next(featureDisabled(feature));
      return;
    }
    next();
  };
}
