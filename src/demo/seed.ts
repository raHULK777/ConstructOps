import type { Queryable } from '../config/database';
import type { Db } from '../config/database';
import type { Logger } from '../utils/logger';
import { hashPassword } from '../utils/password';

/**
 * Demo dataset used by `npm run seed` and by the seed test. Kept in `src` so it
 * is exercised by the suite; nothing else imports it at runtime.
 */

interface DemoUser {
  email: string;
  role: 'admin' | 'field_staff' | 'client';
  firstName: string;
  lastName: string;
}

interface DemoProject {
  name: string;
  status: 'planning' | 'active' | 'completed';
  phase: string;
  progress: number;
  cost: number;
  clientEmail: string;
}

interface DemoChangeOrder {
  projectName: string;
  title: string;
  description: string;
  costImpact: number;
  status: 'pending' | 'approved' | 'rejected';
  signedByClientEmail?: string;
  signedAt?: string;
  ipAddress?: string;
}

interface DemoTenant {
  companyName: string;
  subdomain: string;
  customDomain: string | null;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  enableEstimator: boolean;
  enableClientPortal: boolean;
  enableChangeOrders: boolean;
  pricingMatrix: Record<string, unknown>;
  brandingConfig: Record<string, unknown>;
  users: DemoUser[];
  projects: DemoProject[];
  changeOrders: DemoChangeOrder[];
}

export const DEMO_TENANTS: DemoTenant[] = [
  {
    companyName: 'Alpha Builders Pro',
    subdomain: 'alpha-builders',
    customDomain: 'alpha-builders.example.com',
    logoUrl: 'https://cdn.constructops.example/alpha/logo.svg',
    primaryColor: '#0F172A',
    secondaryColor: '#3B82F6',
    enableEstimator: true,
    enableClientPortal: true,
    enableChangeOrders: true,
    pricingMatrix: {
      base_rates: {
        default: 150,
        residential_remodel: 145,
        commercial_retrofit: 215,
        new_build: 190,
      },
      material_multipliers: { standard: 1, premium: 1.22, luxury: 1.55 },
      contingency_percent: 10,
    },
    brandingConfig: {
      typography: { font_family: 'Manrope', base_size: '16px' },
      layout: { navbar_style: 'solid', sidebar_position: 'left', border_radius: '0.5rem' },
      assets: {
        favicon_url: 'https://cdn.constructops.example/alpha/favicon.ico',
        email_banner_url: 'https://cdn.constructops.example/alpha/email-banner.png',
      },
    },
    users: [
      { email: 'admin@alphabuilders.com', role: 'admin', firstName: 'Alice', lastName: 'Foreman' },
      { email: 'field@alphabuilders.com', role: 'field_staff', firstName: 'Dana', lastName: 'Fields' },
      { email: 'client@alphabuilders.com', role: 'client', firstName: 'Morgan', lastName: 'Hale' },
    ],
    projects: [
      {
        name: 'Downtown Commercial Retrofit Phase 2',
        status: 'active',
        phase: 'Electrical',
        progress: 45,
        cost: 750_000,
        clientEmail: 'client@alphabuilders.com',
      },
      {
        name: 'Harborview Residence Remodel',
        status: 'planning',
        phase: 'Permitting',
        progress: 10,
        cost: 420_000,
        clientEmail: 'client@alphabuilders.com',
      },
    ],
    changeOrders: [
      {
        projectName: 'Downtown Commercial Retrofit Phase 2',
        title: 'Added rooftop HVAC screening',
        description: 'Screening required by the revised facade permit for mechanical equipment.',
        costImpact: 24_500,
        status: 'pending',
      },
      {
        projectName: 'Harborview Residence Remodel',
        title: 'Upgraded to quartz countertops',
        description: 'Client selection change from laminate to quartz in kitchen and both baths.',
        costImpact: 8_200,
        status: 'approved',
        signedByClientEmail: 'client@alphabuilders.com',
        signedAt: '2026-10-20T14:30:00.000Z',
        ipAddress: '203.0.113.10',
      },
    ],
  },
  {
    companyName: 'Summit Renovation Group',
    subdomain: 'summit-renovations',
    customDomain: null,
    logoUrl: 'https://cdn.constructops.example/summit/logo.svg',
    primaryColor: '#14532D',
    secondaryColor: '#F59E0B',
    enableEstimator: true,
    enableClientPortal: true,
    enableChangeOrders: false,
    pricingMatrix: {
      base_rates: { default: 135, residential_remodel: 135, commercial_retrofit: 200, new_build: 175 },
      material_multipliers: { standard: 1, premium: 1.2, luxury: 1.5 },
      contingency_percent: 12,
    },
    brandingConfig: {
      typography: { font_family: 'Inter', base_size: '16px' },
      layout: { navbar_style: 'minimal', sidebar_position: 'left', border_radius: '12px' },
      assets: {
        favicon_url: 'https://cdn.constructops.example/summit/favicon.ico',
        email_banner_url: 'https://cdn.constructops.example/summit/email-banner.png',
      },
    },
    users: [
      { email: 'admin@summitrenovations.com', role: 'admin', firstName: 'Riley', lastName: 'Stone' },
      {
        email: 'client@summitrenovations.com',
        role: 'client',
        firstName: 'Jamie',
        lastName: 'Brooks',
      },
    ],
    projects: [
      {
        name: 'Maple Street Kitchen Build',
        status: 'active',
        phase: 'Framing',
        progress: 30,
        cost: 180_000,
        clientEmail: 'client@summitrenovations.com',
      },
    ],
    changeOrders: [
      {
        projectName: 'Maple Street Kitchen Build',
        title: 'Structural beam replacement',
        description: 'Rotted header discovered after demolition requires an engineered beam.',
        costImpact: 15_000,
        status: 'pending',
      },
    ],
  },
];

export interface SeedDeps {
  db: Db;
  bcryptRounds: number;
  logger: Logger;
}

export interface SeedSummary {
  created: {
    tenants: number;
    users: number;
    projects: number;
    changeOrders: number;
  };
  subdomains: string[];
}

async function ensureTenant(
  client: Queryable,
  tenant: DemoTenant,
): Promise<{ id: string; created: boolean }> {
  // Existence is checked explicitly (rather than inferred from RETURNING) so the
  // "created" counters are accurate regardless of driver behaviour.
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM tenants WHERE subdomain = $1',
    [tenant.subdomain],
  );
  const found = existing.rows[0];
  if (found) return { id: found.id, created: false };

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO tenants (
       company_name, subdomain, custom_domain, logo_url, primary_color, secondary_color,
       enable_estimator, enable_client_portal, enable_change_orders,
       estimator_pricing_matrix, branding_config
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (subdomain) DO NOTHING
     RETURNING id`,
    [
      tenant.companyName,
      tenant.subdomain,
      tenant.customDomain,
      tenant.logoUrl,
      tenant.primaryColor,
      tenant.secondaryColor,
      tenant.enableEstimator,
      tenant.enableClientPortal,
      tenant.enableChangeOrders,
      JSON.stringify(tenant.pricingMatrix),
      JSON.stringify(tenant.brandingConfig),
    ],
  );
  if (inserted.rows[0]) return { id: inserted.rows[0].id, created: true };

  const raced = await client.query<{ id: string }>(
    'SELECT id FROM tenants WHERE subdomain = $1',
    [tenant.subdomain],
  );
  const row = raced.rows[0];
  if (!row) throw new Error(`Tenant ${tenant.subdomain} disappeared during seed.`);
  return { id: row.id, created: false };
}

async function ensureUser(
  client: Queryable,
  tenantId: string,
  user: DemoUser,
  passwordHash: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
    [tenantId, user.email],
  );
  const found = existing.rows[0];
  if (found) return { id: found.id, created: false };

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO users (tenant_id, email, password_hash, role, first_name, last_name)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tenant_id, email) DO NOTHING
     RETURNING id`,
    [tenantId, user.email, passwordHash, user.role, user.firstName, user.lastName],
  );
  if (inserted.rows[0]) return { id: inserted.rows[0].id, created: true };

  const raced = await client.query<{ id: string }>(
    'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
    [tenantId, user.email],
  );
  const row = raced.rows[0];
  if (!row) throw new Error(`User ${user.email} disappeared during seed.`);
  return { id: row.id, created: false };
}

async function ensureProject(
  client: Queryable,
  tenantId: string,
  project: DemoProject,
  clientId: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM projects WHERE tenant_id = $1 AND project_name = $2',
    [tenantId, project.name],
  );
  const found = existing.rows[0];
  if (found) return { id: found.id, created: false };

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO projects (tenant_id, client_id, project_name, status, current_phase, progress_percentage, estimated_cost)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id`,
    [
      tenantId,
      clientId,
      project.name,
      project.status,
      project.phase,
      project.progress,
      project.cost,
    ],
  );
  const row = inserted.rows[0];
  if (!row) throw new Error(`Failed to insert project ${project.name}.`);
  return { id: row.id, created: true };
}

async function ensureChangeOrder(
  client: Queryable,
  tenantId: string,
  projectId: string,
  order: DemoChangeOrder,
  signerId: string | null,
): Promise<boolean> {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM change_orders WHERE tenant_id = $1 AND project_id = $2 AND title = $3',
    [tenantId, projectId, order.title],
  );
  if (existing.rows[0]) return false;

  await client.query(
    `INSERT INTO change_orders
       (tenant_id, project_id, title, description, cost_impact, status, signed_by, signed_at, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      tenantId,
      projectId,
      order.title,
      order.description,
      order.costImpact,
      order.status,
      order.signedByClientEmail ? signerId : null,
      order.signedAt ?? null,
      order.ipAddress ?? null,
    ],
  );
  return true;
}

export async function seedDemoTenants(deps: SeedDeps, password: string): Promise<SeedSummary> {
  if (password.length < 8) {
    throw new Error('Seed password must be at least 8 characters.');
  }

  const passwordHash = await hashPassword(password, deps.bcryptRounds);
  const created = { tenants: 0, users: 0, projects: 0, changeOrders: 0 };
  const subdomains: string[] = [];

  const client = await deps.db.connect();
  try {
    await client.query('BEGIN');

    for (const tenant of DEMO_TENANTS) {
      subdomains.push(tenant.subdomain);

      const tenantResult = await ensureTenant(client, tenant);
      if (tenantResult.created) created.tenants += 1;

      const userIds = new Map<string, string>();
      for (const user of tenant.users) {
        const result = await ensureUser(client, tenantResult.id, user, passwordHash);
        if (result.created) created.users += 1;
        userIds.set(user.email, result.id);
      }

      for (const project of tenant.projects) {
        const clientId = userIds.get(project.clientEmail);
        if (!clientId) throw new Error(`Missing demo client ${project.clientEmail}`);
        const projectResult = await ensureProject(client, tenantResult.id, project, clientId);
        if (projectResult.created) created.projects += 1;

        for (const order of tenant.changeOrders) {
          if (order.projectName !== project.name) continue;
          const signerId = order.signedByClientEmail
            ? (userIds.get(order.signedByClientEmail) ?? null)
            : null;
          const inserted = await ensureChangeOrder(
            client,
            tenantResult.id,
            projectResult.id,
            order,
            signerId,
          );
          if (inserted) created.changeOrders += 1;
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  deps.logger.info('Demo tenants seeded', { ...created });
  return { created, subdomains };
}
