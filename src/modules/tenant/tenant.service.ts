import type { TenantRecord } from '../../types/domain';
import { brandingConfigSchema, type BrandingConfig } from '../../types/tenant';
import type { AppDependencies } from '../../types/dependencies';
import { tenantCacheKeys } from '../../utils/host';
import { badRequest, conflict, notFound } from '../../utils/errors';
import { hashPassword } from '../../utils/password';
import { formatZodError } from '../../utils/validation';
import { mapTenantRow } from './tenant.mapper';
import {
  insertTenant,
  updateTenantBrandingRow,
  type TenantRow,
} from './tenant.repository';
import {
  onboardTenantSchema,
  type BrandingConfigPatch,
  type OnboardTenantBody,
  type UpdateBrandingBody,
} from './tenant.schemas';

export function mergeBranding(base: BrandingConfig, patch: BrandingConfigPatch): BrandingConfig {
  return brandingConfigSchema.parse({
    typography: { ...base.typography, ...patch.typography },
    layout: { ...base.layout, ...patch.layout },
    assets: { ...base.assets, ...patch.assets },
  });
}

async function invalidateTenantCache(
  deps: AppDependencies,
  tenant: TenantRow,
  requestHost: string | null,
): Promise<void> {
  const hosts = new Set<string>();
  if (requestHost) hosts.add(requestHost);
  if (deps.env.platformRootDomain) hosts.add(`${tenant.subdomain}.${deps.env.platformRootDomain}`);
  if (tenant.custom_domain) hosts.add(tenant.custom_domain);

  const keys = [...hosts].flatMap((host) => tenantCacheKeys(host));
  if (keys.length === 0) return;

  try {
    await deps.redis.del(...keys);
    deps.logger.debug('Tenant cache invalidated', { tenantId: tenant.id, keys: keys.length });
  } catch (error) {
    deps.logger.warn('Tenant cache invalidation failed; TTL will expire the stale entry', {
      tenantId: tenant.id,
      error: (error as Error).message,
    });
  }
}

export async function updateTenantBranding(
  deps: AppDependencies,
  params: { tenant: TenantRecord; host: string | null; patch: UpdateBrandingBody },
): Promise<TenantRecord> {
  const { patch, tenant } = params;

  const brandingConfig = patch.brandingConfig
    ? mergeBranding(tenant.branding_config, patch.brandingConfig)
    : undefined;

  const updated = await updateTenantBrandingRow(deps.db, tenant.id, {
    ...(patch.companyName !== undefined ? { companyName: patch.companyName } : {}),
    ...(patch.logoUrl !== undefined ? { logoUrl: patch.logoUrl === '' ? null : patch.logoUrl } : {}),
    ...(patch.primaryColor !== undefined ? { primaryColor: patch.primaryColor } : {}),
    ...(patch.secondaryColor !== undefined ? { secondaryColor: patch.secondaryColor } : {}),
    ...(brandingConfig !== undefined ? { brandingConfig } : {}),
  });

  if (!updated) throw notFound('Tenant not found.');

  await invalidateTenantCache(deps, updated, params.host);
  deps.logger.info('Tenant branding updated', { tenantId: tenant.id });
  return mapTenantRow(updated);
}

export interface OnboardTenantResult {
  tenantId: string;
  subdomain: string;
  adminEmail: string;
}

function translateUniqueViolation(error: unknown): unknown {
  const candidate = error as { code?: string; constraint?: string };
  if (candidate?.code === '23505') {
    const constraint = candidate.constraint ?? '';
    if (constraint.includes('subdomain')) {
      return conflict('A tenant with this subdomain already exists.');
    }
    if (constraint.includes('custom_domain')) {
      return conflict('A tenant with this custom domain already exists.');
    }
    if (constraint.includes('email')) {
      return conflict('An administrator with this email already exists for this tenant.');
    }
    return conflict('A tenant with these details already exists.');
  }
  return error;
}

/**
 * Atomic onboarding: tenant + administrator are created together or not at
 * all (README, "Instant Tenant Onboarding"). Password hashing happens before
 * the transaction opens so the connection is not held during CPU-bound work.
 */
export async function onboardTenant(
  deps: AppDependencies,
  input: OnboardTenantBody,
): Promise<OnboardTenantResult> {
  // Defence in depth: the CLI and any future route validate first, but the
  // service must never trust its caller with a tenant boundary.
  const parsed = onboardTenantSchema.safeParse(input);
  if (!parsed.success) {
    throw badRequest(`Validation failed: ${formatZodError(parsed.error)}`);
  }
  const data = parsed.data;

  const passwordHash = await hashPassword(data.adminPassword, deps.env.bcryptRounds);
  const client = await deps.db.connect();

  try {
    await client.query('BEGIN');

    const tenant = await insertTenant(client, {
      companyName: data.companyName,
      subdomain: data.subdomain,
      customDomain: data.customDomain ? data.customDomain : null,
      enableChangeOrders: data.enableChangeOrders,
      ...(data.primaryColor !== undefined ? { primaryColor: data.primaryColor } : {}),
      ...(data.secondaryColor !== undefined ? { secondaryColor: data.secondaryColor } : {}),
    });

    await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, role, first_name, last_name)
       VALUES ($1, $2, $3, 'admin', 'Company', 'Administrator')`,
      [tenant.id, data.adminEmail, passwordHash],
    );

    await client.query('COMMIT');

    await invalidateTenantCache(
      deps,
      tenant,
      deps.env.platformRootDomain ? `${tenant.subdomain}.${deps.env.platformRootDomain}` : null,
    );

    deps.logger.info('Tenant provisioned', {
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
    });

    return {
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
      adminEmail: data.adminEmail,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw translateUniqueViolation(error);
  } finally {
    client.release();
  }
}
