import type { TenantRecord } from '../../types/domain';
import { brandingConfigSchema, pricingMatrixSchema } from '../../types/tenant';
import type { TenantRow } from './tenant.repository';

export interface PublicTenantBranding {
  companyName: string;
  subdomain: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  brandingConfig: TenantRecord['branding_config'];
  features: {
    estimator: boolean;
    clientPortal: boolean;
    changeOrders: boolean;
  };
}

export interface LoginTenantBranding {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * JSONB is untrusted input: an operator can edit it directly, so a malformed
 * matrix must degrade to defaults instead of breaking every request for that
 * tenant. Same rule for branding config.
 */
export function mapTenantRow(row: TenantRow): TenantRecord {
  const branding = brandingConfigSchema.safeParse(asObject(row.branding_config) ?? {});
  const pricing = pricingMatrixSchema.safeParse(asObject(row.estimator_pricing_matrix) ?? {});

  return {
    id: row.id,
    company_name: row.company_name,
    subdomain: row.subdomain,
    custom_domain: row.custom_domain,
    logo_url: row.logo_url,
    primary_color: row.primary_color,
    secondary_color: row.secondary_color,
    enable_estimator: row.enable_estimator,
    enable_client_portal: row.enable_client_portal,
    enable_change_orders: row.enable_change_orders,
    estimator_pricing_matrix: pricing.success
      ? pricing.data
      : pricingMatrixSchema.parse({}),
    branding_config: branding.success ? branding.data : brandingConfigSchema.parse({}),
  };
}

export function toPublicBranding(tenant: TenantRecord): PublicTenantBranding {
  return {
    companyName: tenant.company_name,
    subdomain: tenant.subdomain,
    logoUrl: tenant.logo_url,
    primaryColor: tenant.primary_color,
    secondaryColor: tenant.secondary_color,
    brandingConfig: tenant.branding_config,
    features: {
      estimator: tenant.enable_estimator,
      clientPortal: tenant.enable_client_portal,
      changeOrders: tenant.enable_change_orders,
    },
  };
}

export function toLoginBranding(tenant: TenantRecord): LoginTenantBranding {
  return {
    companyName: tenant.company_name,
    logoUrl: tenant.logo_url,
    primaryColor: tenant.primary_color,
    secondaryColor: tenant.secondary_color,
  };
}
