import type { RequestHandler } from 'express';
import type { TenantRecord } from '../types/domain';
import type { AppDependencies } from '../types/dependencies';
import { asyncHandler } from '../utils/asyncHandler';
import { notFound } from '../utils/errors';
import { normalizeHost, subdomainCandidate, tenantCacheKey } from '../utils/host';
import { mapTenantRow } from '../modules/tenant/tenant.mapper';
import { findTenantByHost } from '../modules/tenant/tenant.repository';

/** Negative-cache marker: unknown hosts must not hit PostgreSQL on every probe. */
const MISSING_SENTINEL = '__constructops_missing__';
const MISSING_TTL_SECONDS = 30;

function isTenantRecord(value: unknown): value is TenantRecord {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.subdomain === 'string' &&
    typeof candidate.company_name === 'string' &&
    typeof candidate.enable_estimator === 'boolean' &&
    typeof candidate.enable_client_portal === 'boolean' &&
    typeof candidate.enable_change_orders === 'boolean' &&
    candidate.branding_config !== null &&
    typeof candidate.branding_config === 'object' &&
    candidate.estimator_pricing_matrix !== null &&
    typeof candidate.estimator_pricing_matrix === 'object'
  );
}

function parseCachedTenant(raw: string): TenantRecord | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isTenantRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the tenant from the Host header before any controller runs.
 *
 * Redis is a latency optimization only: a cache outage degrades to a database
 * lookup, it never rejects the request. A cached miss is honoured briefly so
 * unknown-host probes cannot be used to amplify database load.
 */
export function tenantResolver(deps: AppDependencies): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const host = normalizeHost(req.headers.host);
    if (!host) throw notFound('Tenant domain context not found.');

    const cacheKey = tenantCacheKey(host);

    let cached: string | null = null;
    try {
      cached = await deps.redis.get(cacheKey);
    } catch (error) {
      deps.logger.warn('Tenant cache read failed; falling back to PostgreSQL', {
        error: (error as Error).message,
      });
    }

    if (cached === MISSING_SENTINEL) {
      throw notFound('Tenant domain context not found.');
    }

    if (cached) {
      const tenant = parseCachedTenant(cached);
      if (tenant) {
        req.tenant = tenant;
        next();
        return;
      }
      // Corrupt or outdated cache entry: drop it and resolve from the database.
      await deps.redis.del(cacheKey).catch(() => undefined);
    }

    const subdomain = subdomainCandidate(host, deps.env.platformRootDomain);
    const row = await findTenantByHost(deps.db, { host, subdomain });

    if (!row) {
      try {
        await deps.redis.setex(cacheKey, MISSING_TTL_SECONDS, MISSING_SENTINEL);
      } catch {
        // Cache is optional; the 404 stands regardless.
      }
      throw notFound('Tenant domain context not found.');
    }

    const tenant = mapTenantRow(row);
    req.tenant = tenant;

    try {
      await deps.redis.setex(
        cacheKey,
        deps.env.tenantCacheTtlSeconds,
        JSON.stringify(tenant),
      );
    } catch (error) {
      deps.logger.warn('Tenant cache write failed; serving without cache', {
        error: (error as Error).message,
      });
    }

    next();
  });
}
