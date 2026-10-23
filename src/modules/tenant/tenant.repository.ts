import type { Queryable } from '../../config/database';

export interface TenantRow {
  id: string;
  company_name: string;
  subdomain: string;
  custom_domain: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  enable_estimator: boolean;
  enable_client_portal: boolean;
  enable_change_orders: boolean;
  estimator_pricing_matrix: unknown;
  branding_config: unknown;
}

export const TENANT_COLUMNS = `
  id, company_name, subdomain, custom_domain, logo_url, primary_color, secondary_color,
  enable_estimator, enable_client_portal, enable_change_orders,
  estimator_pricing_matrix, branding_config
`;

export interface TenantHostLookup {
  host: string;
  subdomain: string | null;
}

/**
 * Resolves the tenant for a normalized host. An exact custom-domain match wins
 * over subdomain inference; `subdomain` is null unless the host is inside the
 * configured platform root domain (see utils/host.ts for why).
 */
export async function findTenantByHost(
  db: Queryable,
  lookup: TenantHostLookup,
): Promise<TenantRow | null> {
  const { rows } = await db.query<TenantRow>(
    `SELECT ${TENANT_COLUMNS}
       FROM tenants
      WHERE custom_domain = $1 OR subdomain = $2
      ORDER BY CASE WHEN custom_domain = $1 THEN 0 ELSE 1 END
      LIMIT 1`,
    [lookup.host, lookup.subdomain],
  );
  return rows[0] ?? null;
}

export async function findTenantById(db: Queryable, tenantId: string): Promise<TenantRow | null> {
  const { rows } = await db.query<TenantRow>(
    `SELECT ${TENANT_COLUMNS} FROM tenants WHERE id = $1 LIMIT 1`,
    [tenantId],
  );
  return rows[0] ?? null;
}

export interface TenantInsert {
  companyName: string;
  subdomain: string;
  customDomain: string | null;
  enableChangeOrders: boolean;
  primaryColor?: string;
  secondaryColor?: string;
}

export async function insertTenant(db: Queryable, input: TenantInsert): Promise<TenantRow> {
  const { rows } = await db.query<TenantRow>(
    `INSERT INTO tenants (company_name, subdomain, custom_domain, enable_change_orders, primary_color, secondary_color)
     VALUES ($1, $2, $3, $4, COALESCE($5, '#0F172A'), COALESCE($6, '#3B82F6'))
     RETURNING ${TENANT_COLUMNS}`,
    [
      input.companyName,
      input.subdomain,
      input.customDomain,
      input.enableChangeOrders,
      input.primaryColor ?? null,
      input.secondaryColor ?? null,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error('Tenant insert returned no row.');
  return row;
}

export interface BrandingUpdate {
  companyName?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  brandingConfig?: unknown;
}

/** Column names come from a fixed map, values always travel as parameters. */
export async function updateTenantBrandingRow(
  db: Queryable,
  tenantId: string,
  patch: BrandingUpdate,
): Promise<TenantRow | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  const columns: Array<[keyof BrandingUpdate, string]> = [
    ['companyName', 'company_name'],
    ['logoUrl', 'logo_url'],
    ['primaryColor', 'primary_color'],
    ['secondaryColor', 'secondary_color'],
    ['brandingConfig', 'branding_config'],
  ];

  for (const [key, column] of columns) {
    const value = patch[key];
    if (value === undefined) continue;
    values.push(key === 'brandingConfig' ? JSON.stringify(value) : value);
    assignments.push(`${column} = $${values.length}`);
  }

  if (assignments.length === 0) return findTenantById(db, tenantId);

  values.push(tenantId);
  const { rows } = await db.query<TenantRow>(
    `UPDATE tenants
        SET ${assignments.join(', ')}
      WHERE id = $${values.length}
      RETURNING ${TENANT_COLUMNS}`,
    values,
  );
  return rows[0] ?? null;
}
