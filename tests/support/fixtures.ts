import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Db } from '../../src/config/database';
import type { UserRole } from '../../src/types/domain';
import { TEST_PASSWORD } from './testEnv';

export const DEFAULT_PRICING_MATRIX = {
  base_rates: {
    default: 150,
    residential_remodel: 145,
    commercial_retrofit: 215,
    new_build: 190,
  },
  material_multipliers: { standard: 1, premium: 1.22, luxury: 1.55 },
  contingency_percent: 10,
};

export const DEFAULT_BRANDING = {
  typography: { font_family: 'Manrope', base_size: '16px' },
  layout: { navbar_style: 'solid', sidebar_position: 'left', border_radius: '0.5rem' },
  assets: {
    favicon_url: 'https://example.com/favicon.ico',
    email_banner_url: 'https://example.com/banner.png',
  },
};

let cachedHash: string | null = null;

export async function testPasswordHash(): Promise<string> {
  cachedHash ??= await bcrypt.hash(TEST_PASSWORD, 4);
  return cachedHash;
}

export interface TenantFixtureOptions {
  subdomain: string;
  companyName?: string;
  customDomain?: string | null;
  enableEstimator?: boolean;
  enableClientPortal?: boolean;
  enableChangeOrders?: boolean;
  pricingMatrix?: unknown;
  brandingConfig?: unknown;
}

export async function insertTenant(db: Db, options: TenantFixtureOptions): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO tenants
       (company_name, subdomain, custom_domain, primary_color, secondary_color,
        enable_estimator, enable_client_portal, enable_change_orders,
        estimator_pricing_matrix, branding_config)
     VALUES ($1,$2,$3,'#0F172A','#3B82F6',$4,$5,$6,$7,$8)
     RETURNING id`,
    [
      options.companyName ?? `Company ${options.subdomain}`,
      options.subdomain,
      options.customDomain ?? null,
      options.enableEstimator ?? true,
      options.enableClientPortal ?? true,
      options.enableChangeOrders ?? true,
      JSON.stringify(options.pricingMatrix ?? DEFAULT_PRICING_MATRIX),
      JSON.stringify(options.brandingConfig ?? DEFAULT_BRANDING),
    ],
  );
  const row = rows[0];
  if (!row) throw new Error('Tenant fixture insert failed.');
  return row.id;
}

export async function insertUser(
  db: Db,
  tenantId: string,
  email: string,
  role: UserRole,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO users (tenant_id, email, password_hash, role, first_name, last_name)
     VALUES ($1,$2,$3,$4,'Test','User') RETURNING id`,
    [tenantId, email, await testPasswordHash(), role],
  );
  const row = rows[0];
  if (!row) throw new Error('User fixture insert failed.');
  return row.id;
}

export interface ProjectFixtureOptions {
  name?: string;
  clientId?: string | null;
  status?: 'planning' | 'active' | 'completed';
  currentPhase?: string;
  progressPercentage?: number;
  estimatedCost?: number;
}

export async function insertProject(
  db: Db,
  tenantId: string,
  options: ProjectFixtureOptions = {},
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO projects (tenant_id, client_id, project_name, status, current_phase, progress_percentage, estimated_cost)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      tenantId,
      options.clientId ?? null,
      options.name ?? 'Test Project',
      options.status ?? 'active',
      options.currentPhase ?? 'Permitting',
      options.progressPercentage ?? 0,
      options.estimatedCost ?? 100_000,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error('Project fixture insert failed.');
  return row.id;
}

export interface SessionFixtureOptions {
  expiresAt?: string;
  revokedAt?: string | null;
}

/** Creates a live session row so a hand-signed access token can authenticate. */
export async function insertSession(
  db: Db,
  tenantId: string,
  userId: string,
  options: SessionFixtureOptions = {},
): Promise<string> {
  const id = randomUUID();
  const hash = createHash('sha256').update(randomUUID()).digest('hex');
  const expiresAt = options.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await db.query(
    `INSERT INTO auth_sessions (id, tenant_id, user_id, refresh_token_hash, expires_at, revoked_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, tenantId, userId, hash, expiresAt, options.revokedAt ?? null],
  );

  return id;
}

export interface ChangeOrderFixtureOptions {
  title?: string;
  description?: string | null;
  costImpact?: number;
  status?: 'pending' | 'approved' | 'rejected';
  signedBy?: string | null;
  signedAt?: string | null;
  ipAddress?: string | null;
}

export async function insertChangeOrder(
  db: Db,
  tenantId: string,
  projectId: string,
  options: ChangeOrderFixtureOptions = {},
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO change_orders
       (tenant_id, project_id, title, description, cost_impact, status, signed_by, signed_at, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [
      tenantId,
      projectId,
      options.title ?? 'Test Change Order',
      options.description ?? null,
      options.costImpact ?? 1_000,
      options.status ?? 'pending',
      options.signedBy ?? null,
      options.signedAt ?? null,
      options.ipAddress ?? null,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error('Change order fixture insert failed.');
  return row.id;
}
