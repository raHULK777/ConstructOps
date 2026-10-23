import type { AuthUser, TenantRecord } from './domain';

declare global {
  namespace Express {
    interface Request {
      /** Correlation id assigned by requestContext; echoed as x-request-id. */
      id: string;
      /** Verified tenant for this request. Set by tenantResolver. */
      tenant?: TenantRecord;
      /** Authenticated principal. Set by authenticate. */
      user?: AuthUser;
      /** Output of validateBody/Params/Query. */
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};
